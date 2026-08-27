mod capture;
mod argos_sidecar;
mod live;
mod models;
mod ocr;
mod secrets;
mod selection;
mod translate;
mod tray;

use capture::{
    capture_primary_monitor, capture_primary_monitor_region, get_active_monitor_info,
    get_monitor_info_at_point, last_captured_surface, MonitorInfo,
};
use secrets::{delete_api_key, get_api_key, has_api_key, store_api_key};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--minimized"])
                .app_name("SelectMind AI")
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "linux")]
            capture::set_app_handle(app.handle().clone());

            // Overlay windows are created at launch (tauri.conf). Force-hide them
            // so a compositor that maps "visible: false" windows still doesn't
            // leave a black rectangle on the desktop.
            // Do NOT call set_ignore_cursor_events here — GTK panics if the
            // GdkWindow is not realized yet (tao unwrap on None).
            for label in ["capture-overlay", "selection-overlay", "live-overlay"] {
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window.hide();
                }
            }

            selection::start_monitor(app.handle());
            if let Err(error) = tray::init_system_tray(app) {
                eprintln!("[selectmind] Failed to initialize system tray: {error}");
            }

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let handle = app.handle().clone();
                let toggle = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyL);
                if let Err(error) = app.global_shortcut().on_shortcut(toggle, move |_app, _shortcut, event| {
                    // Ignore X11 auto-repeat — only the initial key-down toggles.
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let _ = handle.emit("live:toggle-request", ());
                }) {
                    eprintln!("[selectmind] Live translate hotkey registration failed: {error}");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                tray::handle_main_window_close(window.app_handle(), api);
            }
        })
        .invoke_handler(tauri::generate_handler![
            capture_screen_surface,
            capture_last_surface,
            capture_screen_region,
            get_monitor_info,
            get_foreground_monitor_info,
            get_monitor_at_point,
            get_app_version,
            webview_log,
            should_start_minimized,
            ocr_is_available,
            ocr_list_languages,
            ocr_recognize_data_url,
            secret_store_api_key,
            secret_get_api_key,
            secret_delete_api_key,
            secret_has_api_key,
            selection_get_snapshot,
            selection_set_monitor_enabled,
            selection_foreground_window_id,
            selection_show_toolbar,
            selection_trigger_manual_toolbar,
            live_is_available,
            live_set_region,
            live_get_region,
            live_clear_region,
            live_scan,
            live_set_capture_exclusion,
            live_boost_overlay,
            live_continuous_capture_available,
            live_start_continuous_capture,
            live_stop_continuous_capture,
            translate_batch,
            translate_ping_local,
            argos_sidecar_ping,
            argos_sidecar_status,
            models_list,
            models_status,
            models_download,
            models_delete,
            app_exit,
            tray_is_ready,
            set_close_to_tray,
            get_os,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Full primary monitor capture (Phase 2 — xcap / OS APIs).
///
/// `async` so it never runs on the GTK main thread: the Linux path waits on the
/// desktop portal, and blocking the main loop would freeze the portal dialog.
#[tauri::command(async)]
fn capture_screen_surface() -> Result<String, String> {
    capture_primary_monitor()
}

#[tauri::command]
fn capture_last_surface() -> Result<String, String> {
    last_captured_surface()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureRegionArgs {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    scale_factor: f64,
    monitor_x: Option<i32>,
    monitor_y: Option<i32>,
}

/// Crop-free region capture on the monitor used for region picking.
#[tauri::command(async)]
fn capture_screen_region(args: CaptureRegionArgs) -> Result<String, String> {
    if let (Some(monitor_x), Some(monitor_y)) = (args.monitor_x, args.monitor_y) {
        return capture::capture_monitor_region(
            monitor_x,
            monitor_y,
            args.x,
            args.y,
            args.width,
            args.height,
            args.scale_factor,
        );
    }

    capture_primary_monitor_region(
        args.x,
        args.y,
        args.width,
        args.height,
        args.scale_factor,
    )
}

#[tauri::command(async)]
fn get_monitor_info() -> Result<MonitorInfo, String> {
    get_active_monitor_info()
}

#[tauri::command(async)]
fn get_foreground_monitor_info() -> Result<MonitorInfo, String> {
    #[cfg(windows)]
    {
        if selection::foreground_is_own_window() {
            return get_active_monitor_info();
        }

        use windows::Win32::Foundation::RECT;
        use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect};

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return get_active_monitor_info();
            }
            let mut rect = RECT::default();
            GetWindowRect(hwnd, &mut rect).map_err(|error| error.to_string())?;
            let cx = rect.left + (rect.right - rect.left) / 2;
            let cy = rect.top + (rect.bottom - rect.top) / 2;
            return get_monitor_info_at_point(cx, cy);
        }
    }

    #[cfg(not(windows))]
    get_active_monitor_info()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MonitorPointArgs {
    x: i32,
    y: i32,
}

#[tauri::command(async)]
fn get_monitor_at_point(args: MonitorPointArgs) -> Result<MonitorInfo, String> {
    get_monitor_info_at_point(args.x, args.y)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Webview consoles are invisible on Linux (no devtools in release, logs stay
/// inside WebKit). Forward errors here so `tauri dev` output shows them.
#[tauri::command]
fn webview_log(window: tauri::Window, level: String, message: String) {
    eprintln!("[webview:{}:{}] {}", window.label(), level, message);
}

#[tauri::command]
fn should_start_minimized() -> bool {
    std::env::args().any(|arg| arg == "--minimized")
}

#[tauri::command(async)]
fn ocr_is_available() -> bool {
    ocr::is_available()
}

#[tauri::command(async)]
fn ocr_list_languages() -> Result<Vec<String>, String> {
    ocr::list_ocr_languages()
}

#[tauri::command(async)]
fn ocr_recognize_data_url(data_url: String) -> Result<String, String> {
    ocr::recognize_image_data_url(&data_url)
}

#[tauri::command]
fn secret_store_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    store_api_key(&provider_id, &api_key)
}

#[tauri::command]
fn secret_get_api_key(provider_id: String) -> Result<Option<String>, String> {
    get_api_key(&provider_id)
}

#[tauri::command]
fn secret_delete_api_key(provider_id: String) -> Result<(), String> {
    delete_api_key(&provider_id)
}

#[tauri::command]
fn secret_has_api_key(provider_id: String) -> Result<bool, String> {
    has_api_key(&provider_id)
}

#[tauri::command]
fn selection_get_snapshot() -> Result<Option<selection::SelectionSnapshot>, String> {
    selection::get_selection_snapshot()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectionMonitorArgs {
    enabled: bool,
}

#[tauri::command]
fn selection_set_monitor_enabled(args: SelectionMonitorArgs) {
    selection::set_monitor_enabled(args.enabled);
}

#[tauri::command]
fn selection_foreground_window_id() -> isize {
    selection::foreground_window_id()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectionShowToolbarArgs {
    snapshot: selection::SelectionSnapshot,
    source_window_id: isize,
}

/// `async` is required: the implementation hops onto the GTK main thread, so
/// running the command there too would deadlock.
#[tauri::command(async)]
fn selection_show_toolbar(app: tauri::AppHandle, args: SelectionShowToolbarArgs) -> Result<(), String> {
    selection::show_toolbar_for_snapshot(&app, args.snapshot, args.source_window_id)
}

#[tauri::command(async)]
fn selection_trigger_manual_toolbar(app: tauri::AppHandle) {
    selection::show_toolbar_manual(&app);
}

#[tauri::command]
fn live_is_available() -> bool {
    live::is_available()
}

#[tauri::command]
fn live_set_region(region: live::LiveRegion) {
    live::set_region(region);
}

#[tauri::command]
fn live_get_region() -> Option<live::LiveRegion> {
    live::get_region()
}

#[tauri::command]
fn live_clear_region() {
    live::clear_region();
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveScanArgs {
    /// BCP-47 tag of the language shown on screen (falls back to user profile).
    ocr_language: Option<String>,
    /// Previous overlay boxes in capture coordinates — software-masked before OCR
    /// so Linux can keep the webview visible (no hide+settle tax).
    #[serde(default)]
    mask_rects: Vec<live::OverlayMaskRect>,
}

#[tauri::command(async)]
fn live_scan(args: Option<LiveScanArgs>) -> Result<live::LiveScanResult, String> {
    let (language, mask_rects) = match args {
        Some(args) => (args.ocr_language, args.mask_rects),
        None => (None, Vec::new()),
    };
    live::scan_region(language.as_deref(), &mask_rects)
}

/// True when Continuous mode can use GStreamer pipewiresrc (Linux) or is always ok (elsewhere).
#[tauri::command(async)]
fn live_continuous_capture_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        return capture::gstreamer_pipewire::is_available();
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

/// Open ScreenCast + GStreamer stream for Continuous live translate (Linux).
#[tauri::command(async)]
fn live_start_continuous_capture() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        return capture::gstreamer_pipewire::start_stream();
    }
    #[cfg(not(target_os = "linux"))]
    {
        Ok(())
    }
}

#[tauri::command(async)]
fn live_stop_continuous_capture() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        capture::gstreamer_pipewire::stop_stream();
    }
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureExclusionArgs {
    #[cfg_attr(not(windows), allow(dead_code))]
    label: String,
    #[cfg_attr(not(windows), allow(dead_code))]
    exclude: bool,
}

/// Hide a window from screen capture so live OCR never reads our own overlay.
#[tauri::command]
fn live_set_capture_exclusion(
    app: tauri::AppHandle,
    args: CaptureExclusionArgs,
) -> Result<bool, String> {
    #[cfg(windows)]
    {
        use tauri::Manager;

        let window = app
            .get_webview_window(&args.label)
            .ok_or_else(|| format!("Window '{}' not found", args.label))?;

        let hwnd_raw = window
            .hwnd()
            .map_err(|error| error.to_string())?
            .0 as isize;

        live::set_capture_exclusion(hwnd_raw, args.exclude)?;
        return Ok(true);
    }

    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Ok(false)
    }
}

/// Keep the live overlay above full-screen games (HWND_TOPMOST refresh).
#[tauri::command]
fn live_boost_overlay(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri::Manager;

        let window = app
            .get_webview_window("live-overlay")
            .ok_or_else(|| "Live overlay window is not configured".to_string())?;

        let hwnd_raw = window
            .hwnd()
            .map_err(|error| error.to_string())?
            .0 as isize;

        return live::pin_overlay_topmost(hwnd_raw);
    }

    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
fn get_os() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "linux")]
    {
        "linux"
    }
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        "unknown"
    }
}

#[tauri::command(async)]
async fn translate_batch(
    args: translate::TranslateBatchArgs,
) -> Result<translate::TranslateBatchResult, String> {
    // Async google-free uses a shared reqwest Client; other engines spawn_blocking.
    translate::translate_batch(args).await
}

#[tauri::command(async)]
fn translate_ping_local(base_url: Option<String>) -> Result<String, String> {
    translate::ping_local_libretranslate(base_url)
}

#[tauri::command(async)]
fn argos_sidecar_ping() -> Result<String, String> {
    argos_sidecar::ping()
}

#[tauri::command(async)]
fn argos_sidecar_status() -> Result<argos_sidecar::ArgosSidecarStatus, String> {
    argos_sidecar::sidecar_status()
}

#[tauri::command]
fn models_list() -> Result<models::ModelsListResult, String> {
    models::list_models()
}

#[tauri::command]
fn models_status(model_id: String) -> Result<models::ModelStatus, String> {
    models::model_status(&model_id)
}

#[tauri::command]
fn models_download(app: tauri::AppHandle, model_id: String) -> Result<models::ModelStatus, String> {
    models::download_model(app, model_id)
}

#[tauri::command]
fn models_delete(model_id: String) -> Result<(), String> {
    models::delete_model(model_id)
}

#[tauri::command]
fn app_exit() {
    argos_sidecar::shutdown();
    std::process::exit(0);
}

#[tauri::command]
fn tray_is_ready() -> bool {
    tray::is_tray_ready()
}

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    tray::set_close_to_tray(enabled);
}
