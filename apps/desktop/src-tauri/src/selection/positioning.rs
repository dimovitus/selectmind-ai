use super::SelectionSnapshot;
use crate::capture::MonitorInfo;

const GAP: i32 = 8;
const MARGIN: i32 = 12;
const TOOLBAR_HEIGHT: i32 = 44;
const TOOLBAR_WIDTH: i32 = 360;

fn clamp(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

/// Screen bounds for a compact always-on-top toolbar window (physical pixels).
pub fn toolbar_window_bounds(snapshot: &SelectionSnapshot, monitor: &MonitorInfo) -> (i32, i32, u32, u32) {
    let scale = if monitor.scale_factor > 0.0 {
        monitor.scale_factor
    } else {
        1.0
    };

    let sel_left = (snapshot.x - monitor.x) as f64 / scale;
    let sel_top = (snapshot.y - monitor.y) as f64 / scale;
    let sel_bottom = sel_top + (snapshot.height as f64 / scale).max(1.0);

    let vh = (monitor.height as f64 / scale) as i32;
    let vw = (monitor.width as f64 / scale) as i32;

    let mut top = sel_bottom.round() as i32 + GAP;
    if top + TOOLBAR_HEIGHT > vh - MARGIN {
        top = sel_top.round() as i32 - TOOLBAR_HEIGHT - GAP;
    }
    top = clamp(top, MARGIN, vh - TOOLBAR_HEIGHT - MARGIN);

    let left = clamp(sel_left.round() as i32, MARGIN, vw - TOOLBAR_WIDTH - MARGIN);

    let screen_x = monitor.x + (left as f64 * scale).round() as i32;
    let screen_y = monitor.y + (top as f64 * scale).round() as i32;
    let width = (TOOLBAR_WIDTH as f64 * scale).round().max(120.0) as u32;
    let height = (TOOLBAR_HEIGHT as f64 * scale).round().max(32.0) as u32;

    (screen_x, screen_y, width, height)
}
