use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{ImageEncoder, RgbaImage};
use mouse_position::mouse_position::Mouse;
use serde::Serialize;
use xcap::Monitor;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

fn cursor_position() -> Result<(i32, i32), String> {
    match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Ok((x, y)),
        Mouse::Error => {
            let monitor = primary_monitor()?;
            let x = monitor.x().map_err(|error| error.to_string())?;
            let y = monitor.y().map_err(|error| error.to_string())?;
            Ok((x + 100, y + 100))
        }
    }
}

fn primary_monitor() -> Result<Monitor, String> {
    Monitor::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .ok_or_else(|| "Primary monitor not found".to_string())
}

fn monitor_at_point(x: i32, y: i32) -> Result<Monitor, String> {
    Monitor::from_point(x, y).map_err(|error| error.to_string())
}

fn active_monitor() -> Result<Monitor, String> {
    let (x, y) = cursor_position()?;
    monitor_at_point(x, y)
}

fn monitor_at_origin(origin_x: i32, origin_y: i32) -> Result<Monitor, String> {
    monitor_at_point(origin_x + 1, origin_y + 1)
}

fn monitor_to_info(monitor: &Monitor) -> Result<MonitorInfo, String> {
    Ok(MonitorInfo {
        x: monitor.x().map_err(|error| error.to_string())?,
        y: monitor.y().map_err(|error| error.to_string())?,
        width: monitor.width().map_err(|error| error.to_string())?,
        height: monitor.height().map_err(|error| error.to_string())?,
        scale_factor: monitor.scale_factor().map_err(|error| error.to_string())? as f64,
    })
}

fn encode_png_data_url(image: RgbaImage) -> Result<String, String> {
    let (width, height) = image.dimensions();
    let mut png_bytes: Vec<u8> = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
    encoder
        .write_image(
            image.as_raw(),
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|error| error.to_string())?;

    Ok(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(png_bytes)
    ))
}

#[allow(dead_code)]
pub fn get_primary_monitor_info() -> Result<MonitorInfo, String> {
    monitor_to_info(&primary_monitor()?)
}

/// Monitor under the cursor (fallback: primary).
pub fn get_active_monitor_info() -> Result<MonitorInfo, String> {
    monitor_to_info(&active_monitor()?)
}

/// Monitor containing the given screen point (for overlay positioning).
pub fn get_monitor_info_at_point(x: i32, y: i32) -> Result<MonitorInfo, String> {
    monitor_to_info(&monitor_at_point(x, y)?)
}

pub fn capture_primary_monitor() -> Result<String, String> {
    let monitor = active_monitor()?;
    let image = monitor
        .capture_image()
        .map_err(|error| error.to_string())?;
    encode_png_data_url(image)
}

pub fn capture_monitor_region(
    monitor_origin_x: i32,
    monitor_origin_y: i32,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> Result<String, String> {
    if width == 0 || height == 0 {
        return Err("Capture region must be non-empty".to_string());
    }

    let monitor = monitor_at_origin(monitor_origin_x, monitor_origin_y)?;
    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };

    let physical_x = ((x as f64) * scale).round().max(0.0) as u32;
    let physical_y = ((y as f64) * scale).round().max(0.0) as u32;
    let physical_width = ((width as f64) * scale).round().max(1.0) as u32;
    let physical_height = ((height as f64) * scale).round().max(1.0) as u32;

    let image = monitor
        .capture_region(physical_x, physical_y, physical_width, physical_height)
        .map_err(|error| error.to_string())?;

    encode_png_data_url(image)
}

pub fn capture_primary_monitor_region(
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> Result<String, String> {
    let monitor = active_monitor()?;
    let origin_x = monitor.x().map_err(|error| error.to_string())?;
    let origin_y = monitor.y().map_err(|error| error.to_string())?;
    capture_monitor_region(origin_x, origin_y, x, y, width, height, scale_factor)
}

/// Raw RGBA pixels for live translate (no PNG/base64 round-trip).
pub fn capture_monitor_region_rgba(
    monitor_origin_x: i32,
    monitor_origin_y: i32,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> Result<(Vec<u8>, u32, u32), String> {
    if width == 0 || height == 0 {
        return Err("Capture region must be non-empty".to_string());
    }

    let monitor = monitor_at_origin(monitor_origin_x, monitor_origin_y)?;
    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };

    let physical_x = ((x as f64) * scale).round().max(0.0) as u32;
    let physical_y = ((y as f64) * scale).round().max(0.0) as u32;
    let physical_width = ((width as f64) * scale).round().max(1.0) as u32;
    let physical_height = ((height as f64) * scale).round().max(1.0) as u32;

    let image = monitor
        .capture_region(physical_x, physical_y, physical_width, physical_height)
        .map_err(|error| error.to_string())?;

    let (w, h) = image.dimensions();
    Ok((image.into_raw(), w, h))
}
