//! Universal selection capture: simulate Ctrl+C, read the clipboard, restore it.
//!
//! Works in any application (browsers, editors, desktop rename boxes, …) —
//! unlike UIA/Win32 polling which only covers apps that expose selection APIs.

use std::thread;
use std::time::Duration;

use windows::Win32::Foundation::{HANDLE, HGLOBAL};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardSequenceNumber, OpenClipboard,
    SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
    VIRTUAL_KEY, VK_C, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT, VK_SPACE,
};

const CF_UNICODETEXT: u32 = 13;

/// Copies the current selection of the foreground app via a synthetic Ctrl+C
/// and returns it. The user's clipboard text is restored afterwards.
pub fn capture_selection_text() -> Option<String> {
    let saved = read_clipboard_text();
    let seq_before = unsafe { GetClipboardSequenceNumber() };

    send_copy_shortcut();

    // Wait for the target app to publish the copy (up to ~750 ms).
    let mut copied: Option<String> = None;
    for _ in 0..30 {
        thread::sleep(Duration::from_millis(25));
        if unsafe { GetClipboardSequenceNumber() } != seq_before {
            // Give slow apps a moment to finish writing all formats.
            thread::sleep(Duration::from_millis(30));
            copied = read_clipboard_text();
            break;
        }
    }

    if copied.is_some() {
        if let Some(previous) = saved {
            let _ = write_clipboard_text(&previous);
        }
    }

    let text = copied?.trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn key_input(vk: VIRTUAL_KEY, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: if up {
                    KEYEVENTF_KEYUP
                } else {
                    KEYBD_EVENT_FLAGS(0)
                },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn send_copy_shortcut() {
    // Release keys the user may still be holding from the hotkey itself,
    // so they don't turn our Ctrl+C into a different chord.
    let inputs = [
        key_input(VK_SHIFT, true),
        key_input(VK_MENU, true),
        key_input(VK_SPACE, true),
        key_input(VK_LWIN, true),
        key_input(VK_RWIN, true),
        key_input(VK_CONTROL, false),
        key_input(VK_C, false),
        key_input(VK_C, true),
        key_input(VK_CONTROL, true),
    ];

    unsafe {
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
}

fn read_clipboard_text() -> Option<String> {
    unsafe {
        if OpenClipboard(None).is_err() {
            return None;
        }

        let result = (|| {
            let handle = GetClipboardData(CF_UNICODETEXT).ok()?;
            if handle.is_invalid() {
                return None;
            }

            let hglobal = HGLOBAL(handle.0);
            let ptr = GlobalLock(hglobal) as *const u16;
            if ptr.is_null() {
                return None;
            }

            let mut len = 0usize;
            while *ptr.add(len) != 0 {
                len += 1;
            }
            let text = String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len));
            let _ = GlobalUnlock(hglobal);
            Some(text)
        })();

        let _ = CloseClipboard();
        result
    }
}

fn write_clipboard_text(text: &str) -> bool {
    let mut units: Vec<u16> = text.encode_utf16().collect();
    units.push(0);

    unsafe {
        if OpenClipboard(None).is_err() {
            return false;
        }

        let ok = (|| {
            EmptyClipboard().ok()?;

            let hglobal = GlobalAlloc(GMEM_MOVEABLE, units.len() * 2).ok()?;
            let ptr = GlobalLock(hglobal) as *mut u16;
            if ptr.is_null() {
                return None;
            }
            std::ptr::copy_nonoverlapping(units.as_ptr(), ptr, units.len());
            let _ = GlobalUnlock(hglobal);

            // The system owns the memory after a successful SetClipboardData.
            SetClipboardData(CF_UNICODETEXT, Some(HANDLE(hglobal.0))).ok()?;
            Some(())
        })()
        .is_some();

        let _ = CloseClipboard();
        ok
    }
}
