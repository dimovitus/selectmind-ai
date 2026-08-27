use std::thread;

use mouse_position::mouse_position::Mouse;
use tauri::AppHandle;

use super::overlay;
use super::SelectionSnapshot;

pub fn start_monitor(app: &AppHandle) {
    overlay::register_listeners(app);
    // Do not prewarm the hidden transparent overlay: mapping it off-screen
    // (`-32000,-32000`) trips Gdk Wayland protocol error 71. Realize on first use.
}

pub fn set_monitor_enabled(_enabled: bool) {
    // Auto-toolbar (AT-SPI) is not implemented on Linux; the global hotkey still works.
}

pub fn show_toolbar_manual(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        let Some(text) = super::clipboard_unix::capture_selection_text() else {
            eprintln!("[selectmind] manual toolbar: no selected/clipboard text detected");
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

        overlay::show_toolbar_from_manual(&app, snapshot, 0);
    });
}
