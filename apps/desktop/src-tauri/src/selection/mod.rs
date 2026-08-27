mod overlay;
mod positioning;

#[cfg(windows)]
mod clipboard;
#[cfg(windows)]
mod com;
#[cfg(windows)]
mod monitor;
#[cfg(windows)]
mod win;

#[cfg(target_os = "linux")]
mod clipboard_unix;
#[cfg(target_os = "linux")]
mod linux;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionSnapshot {
    pub text: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub window_title: String,
}

pub fn get_selection_snapshot() -> Result<Option<SelectionSnapshot>, String> {
    #[cfg(windows)]
    {
        if win::foreground_is_own_window() {
            return Ok(None);
        }

        if let Some(snapshot) = win::get_win32_selection_snapshot()? {
            return Ok(Some(snapshot));
        }

        if win::foreground_should_skip_uia_probe() {
            return Ok(None);
        }

        return com::run_on_uia_thread(|automation| win::get_uia_selection_snapshot(automation));
    }

    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

pub fn start_monitor(app: &tauri::AppHandle) {
    #[cfg(windows)]
    monitor::init(app);
    #[cfg(target_os = "linux")]
    linux::start_monitor(app);
    #[cfg(not(any(windows, target_os = "linux")))]
    let _ = app;
}

pub fn set_monitor_enabled(enabled: bool) {
    #[cfg(windows)]
    monitor::set_monitor_enabled(enabled);
    #[cfg(target_os = "linux")]
    linux::set_monitor_enabled(enabled);
    #[cfg(not(any(windows, target_os = "linux")))]
    let _ = enabled;
}

/// Show the toolbar for the current selection in ANY app (clipboard-based capture).
pub fn show_toolbar_manual(app: &tauri::AppHandle) {
    #[cfg(windows)]
    monitor::show_toolbar_manual(app);
    #[cfg(target_os = "linux")]
    linux::show_toolbar_manual(app);
    #[cfg(not(any(windows, target_os = "linux")))]
    let _ = app;
}

#[cfg(windows)]
pub fn foreground_is_own_window() -> bool {
    win::foreground_is_own_window()
}

#[cfg(not(windows))]
pub fn foreground_is_own_window() -> bool {
    false
}

#[cfg(windows)]
pub fn foreground_window_id() -> isize {
    win::foreground_window_id()
}

#[cfg(not(windows))]
pub fn foreground_window_id() -> isize {
    0
}

pub fn show_toolbar_for_snapshot(
    app: &tauri::AppHandle,
    snapshot: SelectionSnapshot,
    source_window: isize,
) -> Result<(), String> {
    overlay::show_toolbar_for_snapshot(app, snapshot, source_window)
}
