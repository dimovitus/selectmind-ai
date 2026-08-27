//! Copy the current selection via Ctrl+C (xdotool / wtype) and read the clipboard.
//! On Wayland, compositors often block synthetic keys — fall back to clipboard text.

use std::process::Command;
use std::thread;
use std::time::Duration;

use arboard::Clipboard;

pub fn capture_selection_text() -> Option<String> {
    let mut clipboard = Clipboard::new().ok()?;
    let saved = clipboard.get_text().ok();

    send_copy_shortcut();

    let mut copied: Option<String> = None;
    for _ in 0..25 {
        thread::sleep(Duration::from_millis(30));
        let Ok(text) = clipboard.get_text() else {
            continue;
        };
        if saved.as_ref() == Some(&text) {
            continue;
        }
        if !text.trim().is_empty() {
            copied = Some(text);
            break;
        }
    }

    if copied.is_some() {
        if let Some(previous) = saved.as_ref() {
            let _ = clipboard.set_text(previous.clone());
        }
    }

    let text = copied.or(saved)?.trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn send_copy_shortcut() {
    if std::env::var_os("WAYLAND_DISPLAY").is_some()
        && command_succeeds("wtype", &["-M", "ctrl", "c", "-m", "ctrl"])
    {
        return;
    }

    let _ = command_succeeds("xdotool", &["key", "--clearmodifiers", "ctrl+c"]);
}

fn command_succeeds(program: &str, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}
