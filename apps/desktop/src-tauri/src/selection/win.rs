use std::collections::HashSet;

use uiautomation::patterns::{UITextPattern, UITextRange};
use uiautomation::types::{ControlType, Handle};
use uiautomation::UIAutomation;
use uiautomation::UIElement;
use windows::Win32::Foundation::{HWND, LPARAM, POINT, WPARAM};
use windows::core::w;
use windows::Win32::Graphics::Gdi::ClientToScreen;
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::Controls::{EM_GETSEL, EM_POSFROMCHAR};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, FindWindowW, GetClassNameW, GetForegroundWindow, GetGUIThreadInfo, GetWindowLongPtrW,
    GetWindowTextW, GetWindowThreadProcessId, SetWindowLongPtrW, SetWindowPos, GUITHREADINFO,
    GWL_EXSTYLE, IsWindowVisible, SendMessageW, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOSIZE,
    SWP_NOMOVE, WM_GETTEXT, WM_GETTEXTLENGTH, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};
use windows::core::PCWSTR;

use super::SelectionSnapshot;

const MIN_SELECTION_CHARS: usize = 2;

struct SelectionHit {
    text: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

/// Raw handle of the current foreground window (0 when none).
pub fn foreground_window_id() -> isize {
    unsafe { GetForegroundWindow().0 as isize }
}

/// Passive overlay: stays on top but never steals keyboard focus (toolbar mode).
pub fn configure_overlay_passive(title: &str) -> bool {
    configure_overlay_interactive(title, false)
}

/// Interactive overlay: accepts keyboard input (chat popup mode).
pub fn configure_overlay_interactive(title: &str, interactive: bool) -> bool {
    unsafe {
        let wide: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
        let Ok(hwnd) = FindWindowW(None, PCWSTR(wide.as_ptr())) else {
            return false;
        };
        if hwnd.0.is_null() {
            return false;
        }

        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let desired = if interactive {
            (current & !(WS_EX_NOACTIVATE.0 as isize)) | (WS_EX_TOOLWINDOW.0 as isize)
        } else {
            current | (WS_EX_NOACTIVATE.0 as isize) | (WS_EX_TOOLWINDOW.0 as isize)
        };
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, desired);

        let flags = if interactive {
            SWP_NOMOVE | SWP_NOSIZE
        } else {
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
        };
        let _ = SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags);

        true
    }
}

/// True when the foreground window belongs to SelectMind itself (overlay, main window).
pub fn foreground_is_own_window() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return false;
        }

        let mut process_id = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
        process_id == GetCurrentProcessId()
    }
}

/// Skip expensive UI Automation tree walks on known game engine windows.
/// Does not affect Win32 edit detection (Notepad, etc.).
pub fn foreground_should_skip_uia_probe() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return true;
        }

        let mut class = [0u16; 256];
        let class_len = GetClassNameW(hwnd, &mut class);
        if class_len <= 0 {
            return false;
        }

        let class_name = String::from_utf16_lossy(&class[..class_len as usize]).to_lowercase();
        matches!(
            class_name.as_str(),
            "unitywndclass" | "unrealwindow" | "sdl_app" | "glfw30" | "cryengine" | "valve001"
        ) || class_name.starts_with("gfxui")
    }
}

fn foreground_window_title() -> String {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0.is_null() {
            return String::new();
        }

        let mut buffer = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buffer);
        if len <= 0 {
            return String::new();
        }

        String::from_utf16_lossy(&buffer[..len as usize])
    }
}

fn bounds_for_range(element: &UIElement, range: &UITextRange) -> (i32, i32, i32, i32) {
    if let Ok(enclosing) = range.get_enclosing_element() {
        if let Ok(rect) = enclosing.get_bounding_rectangle() {
            return (
                rect.get_left(),
                rect.get_top(),
                rect.get_width().max(1),
                rect.get_height().max(1),
            );
        }
    }

    if let Ok(rect) = element.get_bounding_rectangle() {
        return (
            rect.get_left(),
            rect.get_top(),
            rect.get_width().max(1),
            rect.get_height().max(1),
        );
    }

    (0, 0, 120, 24)
}

fn try_text_pattern_selection(element: &UIElement) -> Result<Option<SelectionHit>, String> {
    let text_pattern: UITextPattern = match element.get_pattern() {
        Ok(pattern) => pattern,
        Err(_) => return Ok(None),
    };

    let ranges = match text_pattern.get_selection() {
        Ok(ranges) if !ranges.is_empty() => ranges,
        _ => return Ok(None),
    };

    let range = &ranges[0];
    let text = range.get_text(-1).map_err(|error| error.to_string())?;
    let trimmed = text.trim();
    if trimmed.chars().count() < MIN_SELECTION_CHARS {
        return Ok(None);
    }

    let (x, y, width, height) = bounds_for_range(element, range);
    Ok(Some(SelectionHit {
        text: trimmed.to_string(),
        x,
        y,
        width,
        height,
    }))
}

fn push_unique(candidates: &mut Vec<UIElement>, seen: &mut HashSet<isize>, element: UIElement) {
    let key = element.get_runtime_id().ok().map(runtime_id_key);
    if let Some(key) = key {
        if !seen.insert(key) {
            return;
        }
    }
    candidates.push(element);
}

fn runtime_id_key(id: Vec<i32>) -> isize {
    id.iter()
        .fold(17_i64, |acc, part| acc.wrapping_mul(31).wrapping_add(*part as i64)) as isize
}

fn append_ancestors(
    automation: &UIAutomation,
    element: &UIElement,
    candidates: &mut Vec<UIElement>,
    seen: &mut HashSet<isize>,
) {
    push_unique(candidates, seen, element.clone());

    let Ok(walker) = automation.get_control_view_walker() else {
        return;
    };

    let mut current = element.clone();
    for _ in 0..12 {
        let Ok(parent) = walker.get_parent(&current) else {
            break;
        };
        push_unique(candidates, seen, parent.clone());
        current = parent;
    }
}

fn append_focused_in_foreground(
    automation: &UIAutomation,
    candidates: &mut Vec<UIElement>,
    seen: &mut HashSet<isize>,
) {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return;
    }

    let Ok(root) = automation.element_from_handle(Handle::from(hwnd.0 as isize)) else {
        return;
    };

    // Deep UI trees (browsers, Electron apps) must not stall the poll loop.
    let mut budget = 400usize;
    collect_focused_descendants(automation, &root, 0, candidates, seen, &mut budget);
}

fn collect_focused_descendants(
    automation: &UIAutomation,
    element: &UIElement,
    depth: usize,
    candidates: &mut Vec<UIElement>,
    seen: &mut HashSet<isize>,
    budget: &mut usize,
) {
    if depth > 8 || *budget == 0 {
        return;
    }
    *budget -= 1;

    if element.has_keyboard_focus().unwrap_or(false) {
        append_ancestors(automation, element, candidates, seen);
    }

    let Ok(walker) = automation.get_control_view_walker() else {
        return;
    };

    let Ok(first_child) = walker.get_first_child(element) else {
        return;
    };

    let mut current = first_child;
    loop {
        collect_focused_descendants(automation, &current, depth + 1, candidates, seen, budget);
        if *budget == 0 {
            return;
        }
        match walker.get_next_sibling(&current) {
            Ok(next) => current = next,
            Err(_) => break,
        }
    }
}

fn append_text_surface_candidates(
    automation: &UIAutomation,
    candidates: &mut Vec<UIElement>,
    seen: &mut HashSet<isize>,
) {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return;
    }

    let Ok(root) = automation.element_from_handle(Handle::from(hwnd.0 as isize)) else {
        return;
    };

    for control_type in [ControlType::Document, ControlType::Edit, ControlType::Text] {
        let Ok(found) = automation
            .create_matcher()
            .from(root.clone())
            .control_type(control_type)
            .depth(8)
            .timeout(120)
            .find_all()
        else {
            continue;
        };

        for element in found {
            push_unique(candidates, seen, element);
        }
    }
}

fn collect_candidates(automation: &UIAutomation) -> Result<Vec<UIElement>, String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Ok(focused) = automation.get_focused_element() {
        append_ancestors(automation, &focused, &mut candidates, &mut seen);
    }

    append_focused_in_foreground(automation, &mut candidates, &mut seen);
    append_text_surface_candidates(automation, &mut candidates, &mut seen);

    Ok(candidates)
}

fn pos_from_char(hwnd: HWND, index: usize) -> Result<POINT, String> {
    unsafe {
        let packed = SendMessageW(
            hwnd,
            EM_POSFROMCHAR,
            Some(WPARAM(index)),
            Some(LPARAM(0)),
        );
        if packed.0 == -1 {
            return Ok(POINT { x: 0, y: 0 });
        }

        Ok(POINT {
            x: (packed.0 & 0xFFFF) as i16 as i32,
            y: ((packed.0 >> 16) & 0xFFFF) as i16 as i32,
        })
    }
}

fn selection_bounds_from_edit(hwnd: HWND, start: usize, end: usize) -> Result<(i32, i32, i32, i32), String> {
    unsafe {
        let start_point = pos_from_char(hwnd, start)?;
        let end_point = pos_from_char(hwnd, end.saturating_sub(1).max(start))?;

        let mut top_left = POINT {
            x: start_point.x,
            y: start_point.y,
        };
        let mut bottom_right = POINT {
            x: end_point.x + 8,
            y: end_point.y + 18,
        };

        if !ClientToScreen(hwnd, &mut top_left).as_bool() {
            return Err("ClientToScreen failed".to_string());
        }
        if !ClientToScreen(hwnd, &mut bottom_right).as_bool() {
            return Err("ClientToScreen failed".to_string());
        }

        let x = top_left.x.min(bottom_right.x);
        let y = top_left.y.min(bottom_right.y);
        let width = (bottom_right.x - top_left.x).abs().max(40);
        let height = (bottom_right.y - top_left.y).abs().max(18);

        Ok((x, y, width, height))
    }
}

fn find_edit_hwnd(foreground: HWND) -> Option<HWND> {
    unsafe {
        let mut thread_id = 0u32;
        GetWindowThreadProcessId(foreground, Some(&mut thread_id));

        let mut info = GUITHREADINFO {
            cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
            ..Default::default()
        };
        if GetGUIThreadInfo(thread_id, &mut info).is_ok() && !info.hwndFocus.0.is_null() {
            if is_text_edit_hwnd(info.hwndFocus) {
                return Some(info.hwndFocus);
            }
        }

        for class_name in [w!("Edit"), w!("RichEditD2DPT"), w!("RICHEDIT50W")] {
            let mut child = FindWindowExW(Some(foreground), None, class_name, None).ok();
            while let Some(current) = child.filter(|hwnd| !hwnd.0.is_null()) {
                if is_text_edit_hwnd(current) {
                    return Some(current);
                }
                child = FindWindowExW(Some(foreground), Some(current), class_name, None).ok();
            }
        }

        None
    }
}

fn is_text_edit_hwnd(hwnd: HWND) -> bool {
    unsafe { !hwnd.0.is_null() && IsWindowVisible(hwnd).as_bool() }
}

fn read_edit_selection(hwnd: HWND) -> Result<Option<(String, usize, usize)>, String> {
    unsafe {
        // Read-only query: selection bounds come back through the pointers.
        let mut start: u32 = 0;
        let mut end: u32 = 0;
        SendMessageW(
            hwnd,
            EM_GETSEL,
            Some(WPARAM(&mut start as *mut u32 as usize)),
            Some(LPARAM(&mut end as *mut u32 as isize)),
        );

        if start == end {
            return Ok(None);
        }

        let (lo, hi) = if start <= end {
            (start as usize, end as usize)
        } else {
            (end as usize, start as usize)
        };

        let total = SendMessageW(hwnd, WM_GETTEXTLENGTH, None, None).0;
        if total <= 0 || lo >= total as usize {
            return Ok(None);
        }

        let mut buffer = vec![0u16; total as usize + 1];
        let copied = SendMessageW(
            hwnd,
            WM_GETTEXT,
            Some(WPARAM(buffer.len())),
            Some(LPARAM(buffer.as_mut_ptr() as isize)),
        )
        .0;
        if copied <= 0 {
            return Ok(None);
        }

        // EM_GETSEL indices are UTF-16 code units — slice the raw buffer, not a String.
        let hi = hi.min(copied as usize);
        if lo >= hi {
            return Ok(None);
        }

        let selected = String::from_utf16_lossy(&buffer[lo..hi]).trim().to_string();
        if selected.chars().count() < MIN_SELECTION_CHARS {
            return Ok(None);
        }

        Ok(Some((selected, lo, hi)))
    }
}

fn try_win32_edit_selection() -> Result<Option<SelectionHit>, String> {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground.0.is_null() || !IsWindowVisible(foreground).as_bool() {
            return Ok(None);
        }

        let Some(hwnd) = find_edit_hwnd(foreground) else {
            return Ok(None);
        };

        let Some((selected, lo, hi)) = read_edit_selection(hwnd)? else {
            return Ok(None);
        };

        let (x, y, width, height) = selection_bounds_from_edit(hwnd, lo, hi)?;
        Ok(Some(SelectionHit {
            text: selected,
            x,
            y,
            width,
            height,
        }))
    }
}

pub fn get_win32_selection_snapshot() -> Result<Option<SelectionSnapshot>, String> {
    let window_title = foreground_window_title();
    let Some(hit) = try_win32_edit_selection()? else {
        return Ok(None);
    };

    Ok(Some(SelectionSnapshot {
        text: hit.text,
        x: hit.x,
        y: hit.y,
        width: hit.width,
        height: hit.height,
        window_title,
    }))
}

pub fn get_uia_selection_snapshot(
    automation: &UIAutomation,
) -> Result<Option<SelectionSnapshot>, String> {
    let candidates = collect_candidates(automation)?;
    let window_title = foreground_window_title();

    for element in candidates {
        match try_text_pattern_selection(&element) {
            Ok(Some(hit)) => {
                return Ok(Some(SelectionSnapshot {
                    text: hit.text,
                    x: hit.x,
                    y: hit.y,
                    width: hit.width,
                    height: hit.height,
                    window_title,
                }));
            }
            Ok(None) | Err(_) => continue,
        }
    }

    Ok(None)
}
