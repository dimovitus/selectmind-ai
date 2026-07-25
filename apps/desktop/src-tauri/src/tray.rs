use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager,
};

static TRAY_READY: AtomicBool = AtomicBool::new(false);

pub fn is_tray_ready() -> bool {
    TRAY_READY.load(Ordering::Relaxed)
}

fn load_tray_icon(_app: &App) -> tauri::Result<Image<'static>> {
    Image::from_bytes(include_bytes!("../icons/32x32.png"))
}

pub fn show_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.set_skip_taskbar(false);
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
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
    let capture_item = MenuItem::with_id(
        app,
        "tray-capture",
        "Capture region (OCR chat)",
        true,
        None::<&str>,
    )?;
    let ocr_toolbar_item = MenuItem::with_id(
        app,
        "tray-ocr-toolbar",
        "OCR toolbar",
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
            &capture_item,
            &ocr_toolbar_item,
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
            "tray-capture" => {
                let _ = app.emit("desktop:capture-request", ());
            }
            "tray-ocr-toolbar" => {
                let _ = app.emit("desktop:ocr-toolbar-request", ());
            }
            "tray-quit" => {
                std::process::exit(0);
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
