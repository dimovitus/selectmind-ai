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
}

impl LiveRegionStore {
    pub fn set_region(&self, region: LiveRegion) {
        let mut inner = self.inner.lock().expect("live region store poisoned");
        inner.region = Some(region);
        inner.last_hash = None;
    }

    pub fn clear_region(&self) {
        let mut inner = self.inner.lock().expect("live region store poisoned");
        inner.region = None;
        inner.last_hash = None;
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

    pub fn remember_frame(&self, hash: u64) {
        let mut inner = self.inner.lock().expect("live region store poisoned");
        inner.last_hash = Some(hash);
    }
}

const HASH_GRID: u32 = 8;

pub fn frame_hash(rgba: &[u8], width: u32, height: u32) -> u64 {
    if width == 0 || height == 0 || rgba.is_empty() {
        return 0;
    }

    let mut sum = 0u64;
    let cells = (HASH_GRID * HASH_GRID) as u64;

    for gy in 0..HASH_GRID {
        for gx in 0..HASH_GRID {
            let sx = ((gx + 1) * width / (HASH_GRID + 1)).max(1) - 1;
            let sy = ((gy + 1) * height / (HASH_GRID + 1)).max(1) - 1;
            let idx = (sy as usize * width as usize + sx as usize) * 4;
            if idx + 2 >= rgba.len() {
                continue;
            }
            let gray =
                (rgba[idx] as u32 + rgba[idx + 1] as u32 + rgba[idx + 2] as u32) / 3;
            sum += gray as u64;
        }
    }

    let average = sum / cells.max(1);
    let mut hash = 0u64;

    for gy in 0..HASH_GRID {
        for gx in 0..HASH_GRID {
            let sx = ((gx + 1) * width / (HASH_GRID + 1)).max(1) - 1;
            let sy = ((gy + 1) * height / (HASH_GRID + 1)).max(1) - 1;
            let idx = (sy as usize * width as usize + sx as usize) * 4;
            let gray = if idx + 2 >= rgba.len() {
                0
            } else {
                (rgba[idx] as u32 + rgba[idx + 1] as u32 + rgba[idx + 2] as u32) / 3
            };
            hash = (hash << 1) | u64::from(gray as u64 >= average);
        }
    }

    hash
}
