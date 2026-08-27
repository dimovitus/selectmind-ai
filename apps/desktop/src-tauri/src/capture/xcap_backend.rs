//! Screen backend for platforms where `xcap` works (Windows, macOS).

use image::RgbaImage;
use xcap::Monitor;

use super::MonitorInfo;

fn to_info(monitor: &Monitor) -> Result<MonitorInfo, String> {
    Ok(MonitorInfo {
        x: monitor.x().map_err(|error| error.to_string())?,
        y: monitor.y().map_err(|error| error.to_string())?,
        width: monitor.width().map_err(|error| error.to_string())?,
        height: monitor.height().map_err(|error| error.to_string())?,
        scale_factor: monitor.scale_factor().map_err(|error| error.to_string())? as f64,
    })
}

fn handle_at_point(x: i32, y: i32) -> Result<Monitor, String> {
    Monitor::from_point(x, y).map_err(|error| error.to_string())
}

pub fn primary_monitor() -> Result<MonitorInfo, String> {
    let monitor = Monitor::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .ok_or_else(|| "Primary monitor not found".to_string())?;
    to_info(&monitor)
}

pub fn monitor_at_point(x: i32, y: i32) -> Result<MonitorInfo, String> {
    to_info(&handle_at_point(x, y)?)
}

pub fn capture_frame(monitor: &MonitorInfo, _fresh: bool) -> Result<RgbaImage, String> {
    handle_at_point(monitor.x + 1, monitor.y + 1)?
        .capture_image()
        .map_err(|error| error.to_string())
}

pub fn capture_rect(
    monitor: &MonitorInfo,
    rect: (u32, u32, u32, u32),
    _fresh: bool,
) -> Result<RgbaImage, String> {
    let (x, y, width, height) = rect;
    handle_at_point(monitor.x + 1, monitor.y + 1)?
        .capture_region(x, y, width, height)
        .map_err(|error| error.to_string())
}
