use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager,
};

static TRAY_READY: AtomicBool = AtomicBool::new(false);
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);

pub fn is_tray_ready() -> bool {
    TRAY_READY.load(Ordering::Relaxed)
}

pub fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::Relaxed);
}

pub fn should_close_to_tray() -> bool {
    CLOSE_TO_TRAY.load(Ordering::Relaxed)
}

/// Main window X button: hide to tray instead of quitting (when enabled).
pub fn handle_main_window_close(app: &AppHandle, api: &tauri::CloseRequestApi) {
    if !should_close_to_tray() || !is_tray_ready() {
        return;
    }
    api.prevent_close();
    hide_main_window(app);
}

fn load_tray_icon(_app: &App) -> tauri::Result<Image<'static>> {
    Image::from_bytes(include_bytes!("../icons/32x32.png"))
}

pub fn show_main_window(app: &AppHandle) {
    show_main_window_inner(app, true);
}

fn show_main_window_inner(app: &AppHandle, raise: bool) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.set_skip_taskbar(false);
    // Linux/XWayland sometimes leaves the window mapped but invisible until
    // size/position are touched again.
    #[cfg(target_os = "linux")]
    if raise {
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(420.0, 720.0)));
        let _ = window.center();
    }
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    #[cfg(target_os = "linux")]
    if raise {
        // Brief always-on-top poke so KWin actually raises the XWayland window.
        let _ = window.set_always_on_top(true);
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(250));
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.set_always_on_top(false);
            }
        });
    }
}

pub fn hide_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.set_skip_taskbar(true);
    let _ = window.hide();
}

pub fn init_system_tray(app: &App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "tray-show", "Show SelectMind", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "tray-hide", "Hide to tray", true, None::<&str>)?;
    let palette_item = MenuItem::with_id(
        app,
        "tray-palette",
        "Command palette",
        true,
        None::<&str>,
    )?;
    let ocr_chat_item = MenuItem::with_id(app, "tray-ocr-chat", "OCR chat", true, None::<&str>)?;
    let ocr_toolbar_item =
        MenuItem::with_id(app, "tray-ocr-toolbar", "OCR toolbar", true, None::<&str>)?;
    let live_translate_item = MenuItem::with_id(
        app,
        "tray-live-translate",
        "Live translate (Ctrl+Shift+L)",
        true,
        None::<&str>,
    )?;
    let continuous_item = MenuItem::with_id(
        app,
        "tray-live-continuous",
        "Toggle Continuous Live Translate",
        true,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(app, "tray-quit", "Quit SelectMind", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &hide_item,
            &palette_item,
            &ocr_chat_item,
            &ocr_toolbar_item,
            &live_translate_item,
            &continuous_item,
            &quit_item,
        ],
    )?;

    let icon = load_tray_icon(app)?;

    TrayIconBuilder::with_id("selectmind-tray")
        .icon(icon)
        .menu(&menu)
        .tooltip("SelectMind AI")
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "tray-show" => show_main_window(app),
            "tray-hide" => hide_main_window(app),
            "tray-palette" => {
                show_main_window(app);
                let _ = app.emit("desktop:palette-request", ());
            }
            "tray-ocr-chat" => {
                // Keep main hidden during region pick; JS shows it when the chat opens.
                hide_main_window(app);
                let _ = app.emit("desktop:ocr-chat-request", ());
            }
            "tray-ocr-toolbar" => {
                hide_main_window(app);
                let _ = app.emit("desktop:ocr-toolbar-request", ());
            }
            "tray-live-translate" => {
                let _ = app.emit("live:toggle-request", ());
            }
            "tray-live-continuous" => {
                let _ = app.emit("live:continuous-toggle-request", ());
            }
            "tray-quit" => {
                crate::argos_sidecar::shutdown();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    TRAY_READY.store(true, Ordering::Relaxed);
    Ok(())
}
