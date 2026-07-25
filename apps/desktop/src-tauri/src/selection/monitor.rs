use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use mouse_position::mouse_position::Mouse;
use serde::Deserialize;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Listener, Manager, PhysicalPosition, PhysicalSize};

use super::positioning;
use super::win;
use super::SelectionSnapshot;
use crate::capture::get_monitor_info_at_point;

const OVERLAY_LABEL: &str = "selection-overlay";
const OVERLAY_TITLE: &str = "SelectMind Selection";
/// Matches the Chrome extension selection debounce.
const POLL_INTERVAL_ACTIVE: Duration = Duration::from_millis(150);
/// Back off when nothing is selected — reduces load on fullscreen games.
const POLL_INTERVAL_IDLE: Duration = Duration::from_millis(800);
/// When auto-toolbar is off and no overlay is visible.
const POLL_INTERVAL_QUIET: Duration = Duration::from_millis(500);

static MONITOR_ENABLED: AtomicBool = AtomicBool::new(true);
static OVERLAY_BUSY: AtomicBool = AtomicBool::new(false);
static OVERLAY_VISIBLE: AtomicBool = AtomicBool::new(false);
static OVERLAY_READY: AtomicBool = AtomicBool::new(false);
/// When true, the toolbar stays until the user dismisses it (OCR toolbar path).
static OVERLAY_STICKY: AtomicBool = AtomicBool::new(false);
/// Window the current toolbar belongs to; shared with the manual hotkey path.
static SOURCE_WINDOW: AtomicIsize = AtomicIsize::new(0);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SelectionShowPayload {
    snapshot: SelectionSnapshot,
    monitor: crate::capture::MonitorInfo,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OverlayResizePayload {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

pub fn set_monitor_enabled(enabled: bool) {
    MONITOR_ENABLED.store(enabled, Ordering::SeqCst);
}

pub fn init(app: &AppHandle) {
    let busy_handle = app.clone();
    app.listen("selection:overlay-busy", move |_| {
        OVERLAY_BUSY.store(true, Ordering::SeqCst);
        let _ = set_overlay_interactive(&busy_handle, true);
    });

    let idle_handle = app.clone();
    app.listen("selection:overlay-idle", move |_| {
        OVERLAY_BUSY.store(false, Ordering::SeqCst);
        let _ = set_overlay_interactive(&idle_handle, false);
    });

    app.listen("selection:overlay-dismissed", move |_| {
        OVERLAY_BUSY.store(false, Ordering::SeqCst);
        OVERLAY_VISIBLE.store(false, Ordering::SeqCst);
        OVERLAY_STICKY.store(false, Ordering::SeqCst);
        SOURCE_WINDOW.store(0, Ordering::SeqCst);
    });

    app.listen("selection:overlay-ready", move |_| {
        OVERLAY_READY.store(true, Ordering::SeqCst);
    });

    let resize_handle = app.clone();
    app.listen("selection:overlay-resize", move |event| {
        let Ok(payload) = serde_json::from_str::<OverlayResizePayload>(event.payload()) else {
            return;
        };
        let _ = apply_overlay_bounds(&resize_handle, &payload);
    });

    let handle = app.clone();
    thread::spawn(move || {
        prewarm_overlay(&handle);
        selection_monitor_loop(handle);
    });
}

fn run_on_main_thread<F>(app: &AppHandle, operation: F) -> Result<(), String>
where
    F: FnOnce() -> Result<(), String> + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();

    app.run_on_main_thread(move || {
        let _ = sender.send(operation());
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv()
        .map_err(|error| format!("main thread dropped: {error}"))?
}

fn set_overlay_interactive(app: &AppHandle, interactive: bool) -> Result<(), String> {
    let handle = app.clone();
    run_on_main_thread(app, move || {
        let overlay = handle
            .get_webview_window(OVERLAY_LABEL)
            .ok_or_else(|| "Selection overlay window is missing".to_string())?;

        overlay
            .set_focusable(interactive)
            .map_err(|error| error.to_string())?;
        win::configure_overlay_interactive(OVERLAY_TITLE, interactive);

        if interactive {
            overlay.set_focus().map_err(|error| error.to_string())?;
        }

        Ok(())
    })
}

fn apply_overlay_bounds(app: &AppHandle, bounds: &OverlayResizePayload) -> Result<(), String> {
    let bounds = bounds.clone();
    let interactive = OVERLAY_BUSY.load(Ordering::SeqCst);
    let handle = app.clone();

    run_on_main_thread(app, move || {
        let overlay = handle
            .get_webview_window(OVERLAY_LABEL)
            .ok_or_else(|| "Selection overlay window is missing".to_string())?;

        overlay
            .set_position(PhysicalPosition::new(bounds.x, bounds.y))
            .map_err(|error| error.to_string())?;
        overlay
            .set_size(PhysicalSize::new(bounds.width, bounds.height))
            .map_err(|error| error.to_string())?;
        overlay
            .set_always_on_top(true)
            .map_err(|error| error.to_string())?;
        overlay
            .set_focusable(interactive)
            .map_err(|error| error.to_string())?;
        win::configure_overlay_interactive(OVERLAY_TITLE, interactive);

        if interactive {
            overlay.set_focus().map_err(|error| error.to_string())?;
        }

        Ok(())
    })
}

fn prewarm_overlay(app: &AppHandle) {
    let show_handle = app.clone();
    let _ = run_on_main_thread(app, move || {
        let Some(overlay) = show_handle.get_webview_window(OVERLAY_LABEL) else {
            return Ok(());
        };
        overlay.set_position(PhysicalPosition::new(-32000, -32000)).ok();
        overlay.set_focusable(false).ok();
        overlay.show().map_err(|error| error.to_string())?;
        Ok(())
    });

    let deadline = Instant::now() + Duration::from_secs(10);
    while !OVERLAY_READY.load(Ordering::SeqCst) && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(100));
    }

    win::configure_overlay_passive(OVERLAY_TITLE);

    let hide_handle = app.clone();
    let _ = run_on_main_thread(app, move || {
        let Some(overlay) = hide_handle.get_webview_window(OVERLAY_LABEL) else {
            return Ok(());
        };
        overlay.hide().map_err(|error| error.to_string())?;
        Ok(())
    });
}

/// Universal path (works in ANY app): triggered by the global hotkey.
/// Copies the selection via Ctrl+C simulation and shows the toolbar at the cursor.
pub fn show_toolbar_manual(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        // Remember the app that owns the selection before we touch anything.
        let source = win::foreground_window_id();

        let Some(text) = super::clipboard::capture_selection_text() else {
            eprintln!("[selectmind] manual toolbar: no selected text detected");
            return;
        };

        let (cursor_x, cursor_y) = match Mouse::get_mouse_position() {
            Mouse::Position { x, y } => (x, y),
            Mouse::Error => (0, 0),
        };

        let snapshot = SelectionSnapshot {
            text,
            x: cursor_x - 16,
            y: cursor_y - 12,
            width: 32,
            height: 24,
            window_title: String::new(),
        };

        SOURCE_WINDOW.store(source, Ordering::SeqCst);

        match show_toolbar(&app, &snapshot) {
            Ok(()) => {
                OVERLAY_VISIBLE.store(true, Ordering::SeqCst);
            }
            Err(error) => {
                eprintln!("[selectmind] failed to show manual toolbar: {error}");
            }
        }
    });
}

/// OCR toolbar path: show the floating toolbar for text read from a screen region.
pub fn show_toolbar_for_snapshot(
    app: &AppHandle,
    snapshot: SelectionSnapshot,
    source_window: isize,
) -> Result<(), String> {
    let app = app.clone();
    // Must not call show_toolbar on the IPC/main thread — it uses run_on_main_thread
    // and would deadlock (same pattern as show_toolbar_manual).
    thread::spawn(move || {
        SOURCE_WINDOW.store(source_window, Ordering::SeqCst);
        OVERLAY_STICKY.store(true, Ordering::SeqCst);
        match show_toolbar(&app, &snapshot) {
            Ok(()) => {
                OVERLAY_VISIBLE.store(true, Ordering::SeqCst);
            }
            Err(error) => {
                eprintln!("[selectmind] failed to show OCR toolbar: {error}");
            }
        }
    });
    Ok(())
}

fn selection_monitor_loop(app: AppHandle) {
    let mut last_text = String::new();
    let mut idle_polls: u32 = 0;

    loop {
        let overlay_visible = OVERLAY_VISIBLE.load(Ordering::SeqCst);
        let monitor_enabled = MONITOR_ENABLED.load(Ordering::SeqCst);

        let poll_interval = if overlay_visible || monitor_enabled {
            let in_game = win::foreground_should_skip_uia_probe();
            if in_game || idle_polls >= 3 {
                POLL_INTERVAL_IDLE
            } else {
                POLL_INTERVAL_ACTIVE
            }
        } else {
            POLL_INTERVAL_QUIET
        };

        thread::sleep(poll_interval);

        // Visible toolbar is managed the same way regardless of the auto-detect
        // setting, so the manual hotkey works even with auto-toolbar disabled.
        if overlay_visible {
            if OVERLAY_BUSY.load(Ordering::SeqCst) {
                continue;
            }

            if !OVERLAY_STICKY.load(Ordering::SeqCst) {
                let foreground = win::foreground_window_id();
                let stays_open = win::foreground_is_own_window()
                    || foreground == SOURCE_WINDOW.load(Ordering::SeqCst);
                if !stays_open {
                    let _ = hide_overlay(&app);
                    last_text.clear();
                    idle_polls = 0;
                    SOURCE_WINDOW.store(0, Ordering::SeqCst);
                }
            }
            continue;
        }

        if !monitor_enabled {
            last_text.clear();
            continue;
        }

        match super::get_selection_snapshot() {
            Ok(Some(snapshot)) => {
                if snapshot.text == last_text {
                    idle_polls = idle_polls.saturating_add(1);
                    continue;
                }

                idle_polls = 0;
                last_text = snapshot.text.clone();
                SOURCE_WINDOW.store(win::foreground_window_id(), Ordering::SeqCst);

                match show_toolbar(&app, &snapshot) {
                    Ok(()) => {
                        OVERLAY_VISIBLE.store(true, Ordering::SeqCst);
                    }
                    Err(error) => {
                        eprintln!("[selectmind] failed to show toolbar: {error}");
                    }
                }
            }
            Ok(None) => {
                idle_polls = idle_polls.saturating_add(1);
            }
            Err(error) => {
                idle_polls = idle_polls.saturating_add(1);
                eprintln!("[selectmind] selection snapshot error: {error}");
            }
        }
    }
}

fn show_toolbar(app: &AppHandle, snapshot: &SelectionSnapshot) -> Result<(), String> {
    let center_x = snapshot.x + (snapshot.width / 2).max(1);
    let center_y = snapshot.y + (snapshot.height / 2).max(1);
    let monitor = get_monitor_info_at_point(center_x, center_y)?;
    let (x, y, width, height) = positioning::toolbar_window_bounds(snapshot, &monitor);

    let payload = SelectionShowPayload {
        snapshot: snapshot.clone(),
        monitor: monitor.clone(),
    };

    app.emit_to(OVERLAY_LABEL, "selection:show", &payload)
        .map_err(|error| error.to_string())?;

    let bounds = OverlayResizePayload { x, y, width, height };
    apply_overlay_bounds(app, &bounds)?;

    let show_handle = app.clone();
    run_on_main_thread(app, move || {
        let overlay = show_handle
            .get_webview_window(OVERLAY_LABEL)
            .ok_or_else(|| "Selection overlay window is missing".to_string())?;

        if !overlay.is_visible().unwrap_or(false) {
            overlay.show().map_err(|error| error.to_string())?;
        }

        overlay.set_focusable(false).map_err(|error| error.to_string())?;
        win::configure_overlay_passive(OVERLAY_TITLE);
        Ok(())
    })
}

fn hide_overlay(app: &AppHandle) -> Result<(), String> {
    let _ = app.emit_to(OVERLAY_LABEL, "selection:hide", ());

    let hide_handle = app.clone();
    run_on_main_thread(app, move || {
        let Some(overlay) = hide_handle.get_webview_window(OVERLAY_LABEL) else {
            return Ok(());
        };
        overlay.hide().map_err(|error| error.to_string())?;
        Ok(())
    })?;

    OVERLAY_VISIBLE.store(false, Ordering::SeqCst);
    OVERLAY_STICKY.store(false, Ordering::SeqCst);
    SOURCE_WINDOW.store(0, Ordering::SeqCst);
    Ok(())
}
