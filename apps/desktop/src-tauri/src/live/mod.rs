mod region;

pub use region::LiveRegion;

use crate::capture;
use crate::ocr::lines::{self, OcrLineBox};
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

pub fn scan_region() -> Result<LiveScanResult, String> {
    let region = store()
        .get_region()
        .ok_or_else(|| "Live translate region is not set".to_string())?;

    let (rgba, width, height) = capture::capture_monitor_region_rgba(
        region.monitor_x,
        region.monitor_y,
        region.x,
        region.y,
        region.width,
        region.height,
        region.scale_factor,
    )?;

    let frame_hash = region::frame_hash(&rgba, width, height);
    if store().should_skip_frame(frame_hash) {
        return Ok(LiveScanResult {
            frame_unchanged: true,
            lines: Vec::new(),
            frame_hash,
        });
    }

    store().remember_frame(frame_hash);
    let lines = lines::recognize_rgba_lines(&rgba, width, height)?;
    Ok(LiveScanResult {
        frame_unchanged: false,
        lines,
        frame_hash,
    })
}
