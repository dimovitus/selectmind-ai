//! Linux screen backend.
//!
//! `xcap` is not usable here: its Linux build hard-depends on `pipewire`/`libspa`,
//! which fails to compile against PipeWire ≥ 1.4 headers. Monitor geometry comes
//! from Tauri (GDK) instead, and frames come from `xdg-desktop-portal`, the only
//! screenshot interface every Wayland compositor implements.

use std::sync::{mpsc, Mutex, OnceLock};
use std::thread::ThreadId;
use std::time::{Duration, Instant};

use image::RgbaImage;
use tauri::AppHandle;

use super::{crop_rgba, portal, MonitorInfo};

static APP: OnceLock<AppHandle> = OnceLock::new();
static MAIN_THREAD: OnceLock<ThreadId> = OnceLock::new();

/// Portal screenshots cover the whole desktop, so cache the newest frame and let
/// polling callers (live translate) crop from it instead of raising a request
/// per frame.
static LAST_FRAME: Mutex<Option<(Instant, RgbaImage)>> = Mutex::new(None);
const FRAME_TTL: Duration = Duration::from_millis(400);

/// Must be called from the Tauri `setup` hook, which runs on the main thread.
pub fn set_app_handle(app: AppHandle) {
    let _ = APP.set(app);
    let _ = MAIN_THREAD.set(std::thread::current().id());
}

/// GDK monitor queries are only safe on the main thread.
fn on_main_thread<T, F>(operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&AppHandle) -> T + Send + 'static,
{
    let app = APP
        .get()
        .cloned()
        .ok_or_else(|| "Application handle is not ready yet".to_string())?;

    if MAIN_THREAD.get() == Some(&std::thread::current().id()) {
        return Ok(operation(&app));
    }

    let (sender, receiver) = mpsc::channel();
    let worker = app.clone();
    app.run_on_main_thread(move || {
        let _ = sender.send(operation(&worker));
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "Timed out querying monitor geometry".to_string())
}

fn to_info(monitor: &tauri::Monitor) -> MonitorInfo {
    let position = monitor.position();
    let size = monitor.size();
    MonitorInfo {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        scale_factor: monitor.scale_factor(),
    }
}

pub fn primary_monitor() -> Result<MonitorInfo, String> {
    on_main_thread(|app| {
        app.primary_monitor()
            .ok()
            .flatten()
            .or_else(|| app.available_monitors().ok()?.into_iter().next())
            .map(|monitor| to_info(&monitor))
    })?
    .ok_or_else(|| "No monitor reported by the display server".to_string())
}

pub fn monitor_at_point(x: i32, y: i32) -> Result<MonitorInfo, String> {
    let found = on_main_thread(move |app| {
        if let Ok(Some(monitor)) = app.monitor_from_point(x as f64, y as f64) {
            return Some(to_info(&monitor));
        }

        // `monitor_from_point` misses points on monitor edges; fall back to a
        // manual hit test before giving up on the primary monitor.
        let monitors = app.available_monitors().ok()?;
        monitors
            .iter()
            .map(to_info)
            .find(|info| {
                x >= info.x
                    && y >= info.y
                    && x < info.x.saturating_add(info.width as i32)
                    && y < info.y.saturating_add(info.height as i32)
            })
            .or_else(|| monitors.first().map(to_info))
    })?;

    match found {
        Some(info) => Ok(info),
        None => primary_monitor(),
    }
}

fn desktop_frame(fresh: bool) -> Result<RgbaImage, String> {
    // Prefer the live PipeWire stream when Continuous capture is running.
    if let Some(frame) = super::gstreamer_pipewire::try_grab_rgba() {
        if let Ok(mut guard) = LAST_FRAME.lock() {
            *guard = Some((Instant::now(), frame.clone()));
        }
        return Ok(frame);
    }

    if !fresh {
        if let Ok(guard) = LAST_FRAME.lock() {
            if let Some((taken_at, frame)) = guard.as_ref() {
                if taken_at.elapsed() < FRAME_TTL {
                    return Ok(frame.clone());
                }
            }
        }
    }

    // 20 s: enough for the first-run permission dialog, short enough that a hung
    // portal (stuck screenshot tool / unanswered KDE prompt) fails with a clear
    // message instead of freezing the flow for a minute.
    let frame = portal::screenshot(Duration::from_secs(20))?;
    if let Ok(mut guard) = LAST_FRAME.lock() {
        *guard = Some((Instant::now(), frame.clone()));
    }
    Ok(frame)
}

pub fn capture_frame(monitor: &MonitorInfo, fresh: bool) -> Result<RgbaImage, String> {
    let desktop = desktop_frame(fresh)?;
    let (desktop_width, desktop_height) = desktop.dimensions();

    if desktop_width == monitor.width && desktop_height == monitor.height {
        return Ok(desktop);
    }

    // Multi-monitor: the portal hands back the whole layout in one image.
    Ok(crop_rgba(
        &desktop,
        monitor.x.max(0) as u32,
        monitor.y.max(0) as u32,
        monitor.width,
        monitor.height,
    ))
}

pub fn capture_rect(
    monitor: &MonitorInfo,
    rect: (u32, u32, u32, u32),
    fresh: bool,
) -> Result<RgbaImage, String> {
    let (x, y, width, height) = rect;
    let frame = capture_frame(monitor, fresh)?;
    Ok(crop_rgba(&frame, x, y, width, height))
}
