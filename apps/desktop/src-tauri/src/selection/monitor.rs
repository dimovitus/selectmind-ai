use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use mouse_position::mouse_position::Mouse;
use tauri::AppHandle;

use super::overlay;
use super::win;
use super::SelectionSnapshot;

/// Matches the Chrome extension selection debounce.
const POLL_INTERVAL_ACTIVE: Duration = Duration::from_millis(150);
/// Back off when nothing is selected — reduces load on fullscreen games.
const POLL_INTERVAL_IDLE: Duration = Duration::from_millis(800);
/// When auto-toolbar is off and no overlay is visible.
const POLL_INTERVAL_QUIET: Duration = Duration::from_millis(500);

static MONITOR_ENABLED: AtomicBool = AtomicBool::new(true);

pub fn set_monitor_enabled(enabled: bool) {
    MONITOR_ENABLED.store(enabled, Ordering::SeqCst);
}

pub fn init(app: &AppHandle) {
    overlay::register_listeners(app);

    let handle = app.clone();
    thread::spawn(move || {
        overlay::prewarm(&handle);
        selection_monitor_loop(handle);
    });
}

/// Universal path (works in ANY app): triggered by the global hotkey.
/// Copies the selection via Ctrl+C simulation and shows the toolbar at the cursor.
pub fn show_toolbar_manual(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
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

        overlay::show_toolbar_from_manual(&app, snapshot, source);
    });
}

fn selection_monitor_loop(app: AppHandle) {
    let mut last_text = String::new();
    let mut idle_polls: u32 = 0;

    loop {
        let overlay_visible = overlay::overlay_visible();
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

        if overlay_visible {
            if overlay::overlay_busy() {
                continue;
            }

            if !overlay::overlay_sticky() {
                let foreground = win::foreground_window_id();
                let stays_open = win::foreground_is_own_window()
                    || foreground == overlay::source_window();
                if !stays_open {
                    let _ = overlay::hide_overlay(&app);
                    last_text.clear();
                    idle_polls = 0;
                    overlay::set_source_window(0);
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
                overlay::set_source_window(win::foreground_window_id());

                match overlay::show_toolbar(&app, &snapshot) {
                    Ok(()) => {}
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
