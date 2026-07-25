mod capture;
mod ocr;
mod secrets;
mod selection;
mod tray;

use capture::{
    capture_primary_monitor, capture_primary_monitor_region, get_active_monitor_info,
    get_monitor_info_at_point, MonitorInfo,
};
use secrets::{delete_api_key, get_api_key, has_api_key, store_api_key};

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
            selection::start_monitor(app.handle());
            if let Err(error) = tray::init_system_tray(app) {
                eprintln!("[selectmind] Failed to initialize system tray: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture_screen_surface,
            capture_screen_region,
            get_monitor_info,
            get_monitor_at_point,
            get_app_version,
            should_start_minimized,
            ocr_is_available,
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
            app_exit,
            tray_is_ready,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Full primary monitor capture (Phase 2 — xcap / OS APIs).
#[tauri::command]
fn capture_screen_surface() -> Result<String, String> {
    capture_primary_monitor()
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
#[tauri::command]
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

#[tauri::command]
fn get_monitor_info() -> Result<MonitorInfo, String> {
    get_active_monitor_info()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MonitorPointArgs {
    x: i32,
    y: i32,
}

#[tauri::command]
fn get_monitor_at_point(args: MonitorPointArgs) -> Result<MonitorInfo, String> {
    get_monitor_info_at_point(args.x, args.y)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn should_start_minimized() -> bool {
    std::env::args().any(|arg| arg == "--minimized")
}

#[tauri::command]
fn ocr_is_available() -> bool {
    ocr::is_windows_ocr_available()
}

#[tauri::command]
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

#[tauri::command]
fn selection_show_toolbar(app: tauri::AppHandle, args: SelectionShowToolbarArgs) -> Result<(), String> {
    selection::show_toolbar_for_snapshot(&app, args.snapshot, args.source_window_id)
}

#[tauri::command]
fn selection_trigger_manual_toolbar(app: tauri::AppHandle) {
    selection::show_toolbar_manual(&app);
}

#[tauri::command]
fn app_exit() {
    std::process::exit(0);
}

#[tauri::command]
fn tray_is_ready() -> bool {
    tray::is_tray_ready()
}
