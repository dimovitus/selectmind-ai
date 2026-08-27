mod capture_shield;
mod region;

#[cfg(windows)]
pub use capture_shield::{pin_overlay_topmost, set_capture_exclusion};
pub use region::LiveRegion;

use crate::capture;
use crate::ocr::lines::{self, OcrLineBox, OcrLinesResult};
use region::LiveRegionStore;
use serde::Serialize;
use std::sync::OnceLock;

static STORE: OnceLock<LiveRegionStore> = OnceLock::new();

fn store() -> &'static LiveRegionStore {
    STORE.get_or_init(LiveRegionStore::default)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveScanResult {
    pub frame_unchanged: bool,
    pub lines: Vec<OcrLineBox>,
    pub frame_hash: u64,
    /// Captured frame size in physical pixels (diagnostics).
    pub width: u32,
    pub height: u32,
    /// Average brightness 0–255; near zero means the capture came back blank.
    pub mean_luma: u32,
    /// Max minus min sampled brightness; ~0 means a uniform (failed) capture.
    pub luma_range: u32,
    /// Lines returned by OCR before any frontend filtering.
    pub raw_line_count: u32,
    /// Language tag of the OCR engine that ran (diagnostics).
    pub ocr_language: String,
    /// Share of 8×8 cells that changed vs the previous frame (0–100).
    pub roi_area_pct: f64,
    /// `skip` | `roi` | `full` — which OCR path ran.
    pub ocr_scope: String,
}

/// Overlay box in capture-bitmap coordinates (physical pixels, region-relative).
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayMaskRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Native OCR needs reasonably tall glyphs; subtitle strips are usually short.
const UPSCALE_BELOW_HEIGHT: u32 = 300;
/// Keep OCR input within practical bounds on 4K captures.
const MAX_OCR_WIDTH: u32 = 1920;
const MAX_OCR_HEIGHT: u32 = 1080;

fn luma_stats(rgba: &[u8]) -> (u32, u32) {
    let mut sum = 0u64;
    let mut samples = 0u64;
    let mut min = u32::MAX;
    let mut max = 0u32;

    for pixel in rgba.chunks_exact(4).step_by(16) {
        let luma = (u32::from(pixel[0]) + u32::from(pixel[1]) + u32::from(pixel[2])) / 3;
        sum += u64::from(luma);
        samples += 1;
        min = min.min(luma);
        max = max.max(luma);
    }

    if samples == 0 {
        return (0, 0);
    }
    ((sum / samples) as u32, max.saturating_sub(min))
}

fn upscale_nearest(rgba: &[u8], width: u32, height: u32, factor: u32) -> (Vec<u8>, u32, u32) {
    let new_width = width * factor;
    let new_height = height * factor;
    let mut out = vec![0u8; (new_width as usize) * (new_height as usize) * 4];

    for y in 0..height {
        let src_row = (y as usize) * (width as usize) * 4;
        for offset_y in 0..factor {
            let dst_row = ((y * factor + offset_y) as usize) * (new_width as usize) * 4;
            for x in 0..width {
                let src = src_row + (x as usize) * 4;
                let pixel = &rgba[src..src + 4];
                for offset_x in 0..factor {
                    let dst = dst_row + ((x * factor + offset_x) as usize) * 4;
                    out[dst..dst + 4].copy_from_slice(pixel);
                }
            }
        }
    }

    (out, new_width, new_height)
}

/// Downscale large captures before OCR — 4K full-screen scans become ~2× faster.
fn downscale_to_fit(rgba: &[u8], width: u32, height: u32) -> (Vec<u8>, u32, u32, f64) {
    let scale_w = MAX_OCR_WIDTH as f64 / f64::from(width.max(1));
    let scale_h = MAX_OCR_HEIGHT as f64 / f64::from(height.max(1));
    let scale = scale_w.min(scale_h).min(1.0);
    if scale >= 0.999 {
        return (rgba.to_vec(), width, height, 1.0);
    }

    let new_width = ((f64::from(width) * scale).round() as u32).max(1);
    let new_height = ((f64::from(height) * scale).round() as u32).max(1);
    let mut out = vec![0u8; (new_width as usize) * (new_height as usize) * 4];

    for dy in 0..new_height {
        let sy = ((f64::from(dy) / scale).floor() as u32).min(height.saturating_sub(1));
        let src_row = (sy as usize) * (width as usize) * 4;
        let dst_row = (dy as usize) * (new_width as usize) * 4;
        for dx in 0..new_width {
            let sx = ((f64::from(dx) / scale).floor() as u32).min(width.saturating_sub(1));
            let src = src_row + (sx as usize) * 4;
            let dst = dst_row + (dx as usize) * 4;
            out[dst..dst + 4].copy_from_slice(&rgba[src..src + 4]);
        }
    }

    (out, new_width, new_height, 1.0 / scale)
}

fn scale_lines(lines: &mut [OcrLineBox], factor: f64) {
    if (factor - 1.0).abs() < f64::EPSILON {
        return;
    }
    for line in lines {
        line.x *= factor;
        line.y *= factor;
        line.width *= factor;
        line.height *= factor;
    }
}

/// Paint opaque black over previous overlay boxes so OCR never reads our own
/// translations — Linux substitute for WDA_EXCLUDEFROMCAPTURE (no hide+settle).
pub fn mask_overlay_rects(
    rgba: &mut [u8],
    width: u32,
    height: u32,
    rects: &[OverlayMaskRect],
) {
    if width == 0 || height == 0 || rects.is_empty() {
        return;
    }

    for rect in rects {
        if rect.width <= 0.0 || rect.height <= 0.0 {
            continue;
        }
        let pad_x = (rect.height * 0.15).max(2.0);
        let pad_y = (rect.height * 0.12).max(2.0);
        let x0 = (rect.x - pad_x).floor().max(0.0) as u32;
        let y0 = (rect.y - pad_y).floor().max(0.0) as u32;
        let x1 = (rect.x + rect.width + pad_x)
            .ceil()
            .min(f64::from(width)) as u32;
        let y1 = (rect.y + rect.height + pad_y)
            .ceil()
            .min(f64::from(height)) as u32;
        if x1 <= x0 || y1 <= y0 {
            continue;
        }

        for y in y0..y1 {
            let row = (y as usize) * (width as usize) * 4;
            for x in x0..x1 {
                let i = row + (x as usize) * 4;
                if i + 3 < rgba.len() {
                    rgba[i] = 0;
                    rgba[i + 1] = 0;
                    rgba[i + 2] = 0;
                    rgba[i + 3] = 255;
                }
            }
        }
    }
}

pub fn is_available() -> bool {
    lines::is_available()
}

pub fn set_region(region: LiveRegion) {
    store().set_region(region);
}

pub fn clear_region() {
    store().clear_region();
}

pub fn get_region() -> Option<LiveRegion> {
    store().get_region()
}

pub fn scan_region(
    ocr_language: Option<&str>,
    mask_rects: &[OverlayMaskRect],
) -> Result<LiveScanResult, String> {
    let region = store()
        .get_region()
        .ok_or_else(|| "Live translate region is not set".to_string())?;

    let (mut rgba, width, height) = capture::capture_monitor_region_rgba(
        region.monitor_x,
        region.monitor_y,
        region.x,
        region.y,
        region.width,
        region.height,
        region.scale_factor,
    )?;

    // GDI screen captures leave the alpha channel undefined, and Windows OCR
    // discards fully transparent pixels.
    for pixel in rgba.chunks_exact_mut(4) {
        pixel[3] = 255;
    }

    // Mask before hash/OCR so our own overlay never affects either.
    mask_overlay_rects(&mut rgba, width, height, mask_rects);

    let (luma, luma_range) = luma_stats(&rgba);
    let cells = region::frame_cells(&rgba, width, height);
    let frame_hash = region::frame_hash_from_cells(&cells);
    if store().should_skip_frame(frame_hash) {
        return Ok(LiveScanResult {
            frame_unchanged: true,
            lines: Vec::new(),
            frame_hash,
            width,
            height,
            mean_luma: luma,
            luma_range,
            raw_line_count: 0,
            ocr_language: String::new(),
            roi_area_pct: 0.0,
            ocr_scope: "skip".into(),
        });
    }

    // Partial frame change → OCR only the dirty cell union (continuous speedup).
    let dirty_mask = store()
        .last_cells()
        .map(|prev| region::dirty_cell_mask(&prev, &cells));
    let dirty_count = dirty_mask.map(|mask| mask.count_ones()).unwrap_or(64);
    let roi_area_pct = (f64::from(dirty_count) / 64.0) * 100.0;
    let roi = dirty_mask.and_then(|mask| {
        region::dirty_roi(mask, width, height, region::ROI_PADDING_PX)
    });

    let (recognized, ocr_scope) = if let Some(roi) = roi {
        let cropped = crop_rgba_region(&rgba, width, height, roi.x, roi.y, roi.width, roi.height);
        let mut result = ocr_rgba_lines(&cropped, roi.width, roi.height, ocr_language)?;
        for line in &mut result.lines {
            line.x += f64::from(roi.x);
            line.y += f64::from(roi.y);
        }
        let raw_count = result.lines.len();
        let filtered =
            lines::filter_low_contrast_lines(&rgba, width, height, result.lines.clone());
        result.lines = prefer_unfiltered_lines(result.lines, filtered, raw_count);
        result.lines = region::merge_roi_lines(store().last_lines(), result.lines, &roi);
        (result, "roi")
    } else {
        let mut result = ocr_rgba_lines(&rgba, width, height, ocr_language)?;
        let raw_count = result.lines.len();
        let filtered =
            lines::filter_low_contrast_lines(&rgba, width, height, result.lines.clone());
        // Dropping even one wrapped row often removes the body of a multi-line description
        // while the title survives — keep full OCR output unless every line was filtered.
        result.lines = prefer_unfiltered_lines(result.lines, filtered, raw_count);
        (result, "full")
    };

    let raw_line_count = recognized.lines.len() as u32;
    store().remember_scan(frame_hash, cells, recognized.lines.clone());
    Ok(LiveScanResult {
        frame_unchanged: false,
        lines: recognized.lines,
        frame_hash,
        width,
        height,
        mean_luma: luma,
        luma_range,
        raw_line_count,
        ocr_language: recognized.language,
        roi_area_pct,
        ocr_scope: ocr_scope.into(),
    })
}

fn prefer_unfiltered_lines(
    original: Vec<OcrLineBox>,
    filtered: Vec<OcrLineBox>,
    raw_count: usize,
) -> Vec<OcrLineBox> {
    if filtered.is_empty() && raw_count > 0 {
        original
    } else if raw_count > 1 && filtered.len() < raw_count {
        original
    } else {
        filtered
    }
}

fn crop_rgba_region(
    rgba: &[u8],
    width: u32,
    height: u32,
    x: u32,
    y: u32,
    crop_w: u32,
    crop_h: u32,
) -> Vec<u8> {
    let x1 = x.min(width);
    let y1 = y.min(height);
    let w = crop_w.min(width.saturating_sub(x1)).max(1);
    let h = crop_h.min(height.saturating_sub(y1)).max(1);
    let mut out = vec![0u8; (w as usize) * (h as usize) * 4];
    for row in 0..h {
        let src_y = y1 + row;
        let src = ((src_y as usize) * (width as usize) + (x1 as usize)) * 4;
        let dst = (row as usize) * (w as usize) * 4;
        let bytes = (w as usize) * 4;
        out[dst..dst + bytes].copy_from_slice(&rgba[src..src + bytes]);
    }
    out
}

fn ocr_rgba_lines(
    rgba: &[u8],
    width: u32,
    height: u32,
    ocr_language: Option<&str>,
) -> Result<OcrLinesResult, String> {
    let (work_rgba, work_w, work_h, downscale_factor) = downscale_to_fit(rgba, width, height);
    let factor = if work_h < UPSCALE_BELOW_HEIGHT { 2 } else { 1 };
    let mut recognized = if factor == 1 {
        lines::recognize_rgba_lines(&work_rgba, work_w, work_h, ocr_language)?
    } else {
        let (scaled, scaled_width, scaled_height) =
            upscale_nearest(&work_rgba, work_w, work_h, factor);
        let mut result =
            lines::recognize_rgba_lines(&scaled, scaled_width, scaled_height, ocr_language)?;
        let divisor = f64::from(factor);
        for line in &mut result.lines {
            line.x /= divisor;
            line.y /= divisor;
            line.width /= divisor;
            line.height /= divisor;
        }
        result
    };
    scale_lines(&mut recognized.lines, downscale_factor);
    Ok(recognized)
}

#[cfg(test)]
mod tests {
    use super::{mask_overlay_rects, OverlayMaskRect};

    #[test]
    fn software_mask_fills_rect_black() {
        let width = 20u32;
        let height = 20u32;
        let mut rgba = vec![200u8; (width * height * 4) as usize];
        mask_overlay_rects(
            &mut rgba,
            width,
            height,
            &[OverlayMaskRect {
                x: 8.0,
                y: 8.0,
                width: 4.0,
                height: 4.0,
            }],
        );
        let idx = ((9 * width + 9) * 4) as usize;
        assert_eq!(&rgba[idx..idx + 3], &[0, 0, 0]);
        let corner = ((0 * width + 0) * 4) as usize;
        assert_eq!(rgba[corner], 200);
    }
}
