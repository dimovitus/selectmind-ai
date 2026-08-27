#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
mod portal;
#[cfg(target_os = "linux")]
mod screencast;
/// Continuous capture: ScreenCast FD → GStreamer pipewiresrc.
#[cfg(target_os = "linux")]
pub mod gstreamer_pipewire;
#[cfg(not(target_os = "linux"))]
mod xcap_backend;

#[cfg(target_os = "linux")]
use linux as backend;
#[cfg(not(target_os = "linux"))]
use xcap_backend as backend;

use std::sync::Mutex;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{ImageEncoder, RgbaImage};
use mouse_position::mouse_position::Mouse;
use serde::Serialize;

#[cfg(target_os = "linux")]
pub use linux::set_app_handle;

static LAST_SURFACE: Mutex<Option<String>> = Mutex::new(None);

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
            let monitor = backend::primary_monitor()?;
            Ok((monitor.x + 100, monitor.y + 100))
        }
    }
}

/// Monitor under the cursor, falling back to the primary one.
fn active_monitor() -> Result<MonitorInfo, String> {
    let (x, y) = cursor_position()?;
    backend::monitor_at_point(x, y)
}

fn monitor_at_origin(origin_x: i32, origin_y: i32) -> Result<MonitorInfo, String> {
    backend::monitor_at_point(origin_x + 1, origin_y + 1)
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

fn crop_rgba(image: &RgbaImage, x: u32, y: u32, width: u32, height: u32) -> RgbaImage {
    let (image_width, image_height) = image.dimensions();
    if image_width == 0 || image_height == 0 {
        return image.clone();
    }

    let x = x.min(image_width - 1);
    let y = y.min(image_height - 1);
    let width = width.min(image_width - x).max(1);
    let height = height.min(image_height - y).max(1);

    let mut out = RgbaImage::new(width, height);
    for row in 0..height {
        for column in 0..width {
            out.put_pixel(column, row, *image.get_pixel(x + column, y + row));
        }
    }
    out
}

#[allow(dead_code)]
pub fn get_primary_monitor_info() -> Result<MonitorInfo, String> {
    backend::primary_monitor()
}

/// Monitor under the cursor (fallback: primary).
pub fn get_active_monitor_info() -> Result<MonitorInfo, String> {
    active_monitor()
}

/// Monitor containing the given screen point (for overlay positioning).
pub fn get_monitor_info_at_point(x: i32, y: i32) -> Result<MonitorInfo, String> {
    backend::monitor_at_point(x, y)
}

pub fn capture_primary_monitor() -> Result<String, String> {
    let monitor = active_monitor()?;
    let image = backend::capture_frame(&monitor, true)?;
    let url = encode_png_data_url(image)?;
    if let Ok(mut slot) = LAST_SURFACE.lock() {
        *slot = Some(url.clone());
    }
    Ok(url)
}

pub fn last_captured_surface() -> Result<String, String> {
    LAST_SURFACE
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
        .ok_or_else(|| "No screenshot captured yet".to_string())
}

/// Region rectangle in physical pixels, relative to the monitor origin.
fn physical_rect(
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> Result<(u32, u32, u32, u32), String> {
    if width == 0 || height == 0 {
        return Err("Capture region must be non-empty".to_string());
    }

    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };
    Ok((
        ((x as f64) * scale).round().max(0.0) as u32,
        ((y as f64) * scale).round().max(0.0) as u32,
        ((width as f64) * scale).round().max(1.0) as u32,
        ((height as f64) * scale).round().max(1.0) as u32,
    ))
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
    let monitor = monitor_at_origin(monitor_origin_x, monitor_origin_y)?;
    let rect = physical_rect(x, y, width, height, scale_factor)?;
    let image = backend::capture_rect(&monitor, rect, true)?;
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
    capture_monitor_region(monitor.x, monitor.y, x, y, width, height, scale_factor)
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
    let monitor = monitor_at_origin(monitor_origin_x, monitor_origin_y)?;
    let rect = physical_rect(x, y, width, height, scale_factor)?;
    let image = backend::capture_rect(&monitor, rect, false)?;

    let (width, height) = image.dimensions();
    Ok((image.into_raw(), width, height))
}
