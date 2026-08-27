use crate::ocr::lines::OcrLineBox;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveRegion {
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[derive(Default)]
pub struct LiveRegionStore {
    inner: Mutex<LiveRegionStoreInner>,
}

#[derive(Default)]
struct LiveRegionStoreInner {
    region: Option<LiveRegion>,
    last_hash: Option<u64>,
    last_cells: Option<[u8; CELL_COUNT]>,
    last_lines: Vec<OcrLineBox>,
}

pub const HASH_GRID: u32 = 8;
const CELL_COUNT: usize = (HASH_GRID * HASH_GRID) as usize;
/// Per-cell gray delta that counts as changed (filters capture noise).
const DIRTY_CELL_DELTA: u8 = 10;
/// More dirty cells than this → full-frame OCR (about ⅜ of the grid).
const FULL_OCR_DIRTY_CELLS: u32 = 24;
/// ROI covering this fraction of the frame also falls back to full OCR.
const FULL_OCR_AREA_RATIO: f64 = 0.7;
/// Expand dirty cells so glyphs straddling a cell edge still OCR cleanly.
pub const ROI_PADDING_PX: u32 = 24;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RoiRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl LiveRegionStore {
    pub fn set_region(&self, region: LiveRegion) {
        let mut inner = self.inner.lock().expect("live region store poisoned");
        inner.region = Some(region);
        inner.last_hash = None;
        inner.last_cells = None;
        inner.last_lines.clear();
    }

    pub fn clear_region(&self) {
        let mut inner = self.inner.lock().expect("live region store poisoned");
        inner.region = None;
        inner.last_hash = None;
        inner.last_cells = None;
        inner.last_lines.clear();
    }

    pub fn get_region(&self) -> Option<LiveRegion> {
        self.inner
            .lock()
            .expect("live region store poisoned")
            .region
            .clone()
    }

    pub fn should_skip_frame(&self, hash: u64) -> bool {
        let inner = self.inner.lock().expect("live region store poisoned");
        inner.last_hash == Some(hash)
    }

    pub fn last_cells(&self) -> Option<[u8; CELL_COUNT]> {
        self.inner
            .lock()
            .expect("live region store poisoned")
            .last_cells
    }

    pub fn last_lines(&self) -> Vec<OcrLineBox> {
        self.inner
            .lock()
            .expect("live region store poisoned")
            .last_lines
            .clone()
    }

    pub fn remember_scan(&self, hash: u64, cells: [u8; CELL_COUNT], lines: Vec<OcrLineBox>) {
        let mut inner = self.inner.lock().expect("live region store poisoned");
        inner.last_hash = Some(hash);
        inner.last_cells = Some(cells);
        inner.last_lines = lines;
    }
}

/// Mean luma per 8×8 cell (subsampled). Used for both perceptual hash and dirty masks.
pub fn frame_cells(rgba: &[u8], width: u32, height: u32) -> [u8; CELL_COUNT] {
    let mut cells = [0u8; CELL_COUNT];
    if width == 0 || height == 0 || rgba.is_empty() {
        return cells;
    }

    for gy in 0..HASH_GRID {
        for gx in 0..HASH_GRID {
            let x0 = gx * width / HASH_GRID;
            let x1 = ((gx + 1) * width / HASH_GRID).max(x0 + 1);
            let y0 = gy * height / HASH_GRID;
            let y1 = ((gy + 1) * height / HASH_GRID).max(y0 + 1);
            let mut sum = 0u64;
            let mut count = 0u64;
            // Sample ~4×4 points inside the cell — enough to catch UI text changes.
            let step_x = ((x1 - x0) / 4).max(1);
            let step_y = ((y1 - y0) / 4).max(1);
            let mut y = y0;
            while y < y1 {
                let mut x = x0;
                while x < x1 {
                    let idx = (y as usize * width as usize + x as usize) * 4;
                    if idx + 2 < rgba.len() {
                        sum += (rgba[idx] as u64 + rgba[idx + 1] as u64 + rgba[idx + 2] as u64) / 3;
                        count += 1;
                    }
                    x = x.saturating_add(step_x);
                }
                y = y.saturating_add(step_y);
            }
            cells[(gy * HASH_GRID + gx) as usize] = if count == 0 {
                0
            } else {
                (sum / count) as u8
            };
        }
    }
    cells
}

pub fn frame_hash_from_cells(cells: &[u8; CELL_COUNT]) -> u64 {
    let sum: u64 = cells.iter().map(|&c| c as u64).sum();
    let average = sum / (CELL_COUNT as u64).max(1);
    let mut hash = 0u64;
    for &gray in cells {
        hash = (hash << 1) | u64::from(gray as u64 >= average);
    }
    hash
}

pub fn frame_hash(rgba: &[u8], width: u32, height: u32) -> u64 {
    frame_hash_from_cells(&frame_cells(rgba, width, height))
}

/// Bit i set ⇒ cell i differs from the previous frame by more than DIRTY_CELL_DELTA.
pub fn dirty_cell_mask(prev: &[u8; CELL_COUNT], next: &[u8; CELL_COUNT]) -> u64 {
    let mut mask = 0u64;
    for i in 0..CELL_COUNT {
        let delta = prev[i].abs_diff(next[i]);
        if delta >= DIRTY_CELL_DELTA {
            mask |= 1u64 << i;
        }
    }
    mask
}

/// Axis-aligned union of dirty cells, expanded by padding and clipped to the frame.
/// Returns `None` when nothing is dirty or the ROI is large enough that full OCR is cheaper.
pub fn dirty_roi(
    dirty_mask: u64,
    width: u32,
    height: u32,
    padding: u32,
) -> Option<RoiRect> {
    if dirty_mask == 0 || width == 0 || height == 0 {
        return None;
    }

    let dirty_count = dirty_mask.count_ones();
    if dirty_count >= FULL_OCR_DIRTY_CELLS {
        return None;
    }

    let mut min_gx = HASH_GRID;
    let mut max_gx = 0u32;
    let mut min_gy = HASH_GRID;
    let mut max_gy = 0u32;

    for i in 0..CELL_COUNT {
        if dirty_mask & (1u64 << i) == 0 {
            continue;
        }
        let gx = (i as u32) % HASH_GRID;
        let gy = (i as u32) / HASH_GRID;
        min_gx = min_gx.min(gx);
        max_gx = max_gx.max(gx);
        min_gy = min_gy.min(gy);
        max_gy = max_gy.max(gy);
    }

    if min_gx > max_gx || min_gy > max_gy {
        return None;
    }

    let cell_w = width / HASH_GRID;
    let cell_h = height / HASH_GRID;
    let x0 = min_gx * cell_w;
    let y0 = min_gy * cell_h;
    // Last cell absorbs remainder pixels so the right/bottom edge is covered.
    let x1 = if max_gx + 1 >= HASH_GRID {
        width
    } else {
        (max_gx + 1) * cell_w
    };
    let y1 = if max_gy + 1 >= HASH_GRID {
        height
    } else {
        (max_gy + 1) * cell_h
    };

    let pad_x0 = x0.saturating_sub(padding);
    let pad_y0 = y0.saturating_sub(padding);
    let pad_x1 = (x1 + padding).min(width);
    let pad_y1 = (y1 + padding).min(height);
    let roi_w = pad_x1.saturating_sub(pad_x0);
    let roi_h = pad_y1.saturating_sub(pad_y0);
    if roi_w == 0 || roi_h == 0 {
        return None;
    }

    let area_ratio =
        (f64::from(roi_w) * f64::from(roi_h)) / (f64::from(width) * f64::from(height)).max(1.0);
    if area_ratio >= FULL_OCR_AREA_RATIO {
        return None;
    }

    Some(RoiRect {
        x: pad_x0,
        y: pad_y0,
        width: roi_w,
        height: roi_h,
    })
}

pub fn line_intersects_roi(line: &OcrLineBox, roi: &RoiRect) -> bool {
    let lx1 = line.x;
    let ly1 = line.y;
    let lx2 = line.x + line.width;
    let ly2 = line.y + line.height;
    let rx1 = f64::from(roi.x);
    let ry1 = f64::from(roi.y);
    let rx2 = f64::from(roi.x + roi.width);
    let ry2 = f64::from(roi.y + roi.height);
    !(lx2 < rx1 || lx1 > rx2 || ly2 < ry1 || ly1 > ry2)
}

/// Keep previous lines outside the ROI; replace anything that overlaps it with the new OCR.
pub fn merge_roi_lines(
    previous: Vec<OcrLineBox>,
    roi_lines: Vec<OcrLineBox>,
    roi: &RoiRect,
) -> Vec<OcrLineBox> {
    let mut merged: Vec<OcrLineBox> = previous
        .into_iter()
        .filter(|line| !line_intersects_roi(line, roi))
        .collect();
    merged.extend(roi_lines);
    merged
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ocr::lines::OcrLineBox;

    fn solid_frame(width: u32, height: u32, gray: u8) -> Vec<u8> {
        let mut rgba = vec![0u8; (width * height * 4) as usize];
        for pixel in rgba.chunks_exact_mut(4) {
            pixel[0] = gray;
            pixel[1] = gray;
            pixel[2] = gray;
            pixel[3] = 255;
        }
        rgba
    }

    fn paint_rect(rgba: &mut [u8], width: u32, x: u32, y: u32, w: u32, h: u32, gray: u8) {
        for py in y..y + h {
            for px in x..x + w {
                let idx = (py as usize * width as usize + px as usize) * 4;
                rgba[idx] = gray;
                rgba[idx + 1] = gray;
                rgba[idx + 2] = gray;
            }
        }
    }

    #[test]
    fn identical_frames_share_hash_and_no_dirty() {
        let a = solid_frame(64, 64, 100);
        let b = solid_frame(64, 64, 100);
        let ca = frame_cells(&a, 64, 64);
        let cb = frame_cells(&b, 64, 64);
        assert_eq!(frame_hash_from_cells(&ca), frame_hash_from_cells(&cb));
        assert_eq!(dirty_cell_mask(&ca, &cb), 0);
    }

    #[test]
    fn local_change_yields_small_roi() {
        let a = solid_frame(160, 160, 40);
        let mut b = a.clone();
        // Change only the top-left corner (~2×2 cells).
        paint_rect(&mut b, 160, 4, 4, 30, 30, 220);
        let ca = frame_cells(&a, 160, 160);
        let cb = frame_cells(&b, 160, 160);
        let mask = dirty_cell_mask(&ca, &cb);
        assert!(mask.count_ones() > 0);
        assert!(mask.count_ones() < FULL_OCR_DIRTY_CELLS);
        let roi = dirty_roi(mask, 160, 160, ROI_PADDING_PX).expect("roi");
        assert!(roi.x < 40);
        assert!(roi.y < 40);
        assert!(roi.width < 120);
        assert!(roi.height < 120);
    }

    #[test]
    fn merge_replaces_overlapping_lines_only() {
        let prev = vec![
            OcrLineBox {
                text: "keep".into(),
                x: 0.0,
                y: 0.0,
                width: 40.0,
                height: 12.0,
            },
            OcrLineBox {
                text: "replace".into(),
                x: 100.0,
                y: 100.0,
                width: 40.0,
                height: 12.0,
            },
        ];
        let roi = RoiRect {
            x: 90,
            y: 90,
            width: 60,
            height: 60,
        };
        let next = vec![OcrLineBox {
            text: "new".into(),
            x: 100.0,
            y: 100.0,
            width: 40.0,
            height: 12.0,
        }];
        let merged = merge_roi_lines(prev, next, &roi);
        assert_eq!(merged.len(), 2);
        assert!(merged.iter().any(|l| l.text == "keep"));
        assert!(merged.iter().any(|l| l.text == "new"));
        assert!(!merged.iter().any(|l| l.text == "replace"));
    }
}
