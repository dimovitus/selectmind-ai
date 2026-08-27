use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Listener, Manager, PhysicalPosition, PhysicalSize};

use super::positioning;
use super::SelectionSnapshot;
use crate::capture::get_monitor_info_at_point;

pub const OVERLAY_LABEL: &str = "selection-overlay";
const OVERLAY_TITLE: &str = "SelectMind Selection";

static OVERLAY_BUSY: AtomicBool = AtomicBool::new(false);
static OVERLAY_VISIBLE: AtomicBool = AtomicBool::new(false);
static OVERLAY_READY: AtomicBool = AtomicBool::new(false);
static OVERLAY_STICKY: AtomicBool = AtomicBool::new(false);
static SOURCE_WINDOW: AtomicIsize = AtomicIsize::new(0);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SelectionShowPayload {
    snapshot: SelectionSnapshot,
    monitor: crate::capture::MonitorInfo,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OverlayResizePayload {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

pub fn overlay_visible() -> bool {
    OVERLAY_VISIBLE.load(Ordering::SeqCst)
}

pub fn overlay_busy() -> bool {
    OVERLAY_BUSY.load(Ordering::SeqCst)
}

pub fn overlay_sticky() -> bool {
    OVERLAY_STICKY.load(Ordering::SeqCst)
}

pub fn set_sticky(sticky: bool) {
    OVERLAY_STICKY.store(sticky, Ordering::SeqCst);
}

pub fn set_source_window(id: isize) {
    SOURCE_WINDOW.store(id, Ordering::SeqCst);
}

pub fn source_window() -> isize {
    SOURCE_WINDOW.load(Ordering::SeqCst)
}

pub fn register_listeners(app: &AppHandle) {
    let busy_handle = app.clone();
    app.listen("selection:overlay-busy", move |_| {
        OVERLAY_BUSY.store(true, Ordering::SeqCst);
        let _ = set_overlay_interactive(&busy_handle, true);
    });

    let idle_handle = app.clone();
    app.listen("selection:overlay-idle", move |_| {
        OVERLAY_BUSY.store(false, Ordering::SeqCst);
        let _ = set_overlay_interactive(&idle_handle, false);
    });

    app.listen("selection:overlay-dismissed", move |_| {
        OVERLAY_BUSY.store(false, Ordering::SeqCst);
        OVERLAY_VISIBLE.store(false, Ordering::SeqCst);
        OVERLAY_STICKY.store(false, Ordering::SeqCst);
        SOURCE_WINDOW.store(0, Ordering::SeqCst);
    });

    app.listen("selection:overlay-ready", move |_| {
        OVERLAY_READY.store(true, Ordering::SeqCst);
    });

    let resize_handle = app.clone();
    app.listen("selection:overlay-resize", move |event| {
        let Ok(payload) = serde_json::from_str::<OverlayResizePayload>(event.payload()) else {
            return;
        };
        let _ = apply_overlay_bounds(&resize_handle, &payload);
    });
}

pub fn prewarm(app: &AppHandle) {
    #[cfg(target_os = "linux")]
    {
        let _ = app;
    }

    #[cfg(not(target_os = "linux"))]
    {
        let show_handle = app.clone();
        let _ = run_on_main_thread(app, move || {
            let Some(overlay) = show_handle.get_webview_window(OVERLAY_LABEL) else {
                return Ok(());
            };
            overlay.set_position(PhysicalPosition::new(-32000, -32000)).ok();
            overlay.set_focusable(false).ok();
            overlay.show().map_err(|error| error.to_string())?;
            set_click_through(&overlay, true);
            Ok(())
        });

        let deadline = Instant::now() + Duration::from_secs(10);
        while !OVERLAY_READY.load(Ordering::SeqCst) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(100));
        }

        configure_native(false);

        let hide_handle = app.clone();
        let _ = run_on_main_thread(app, move || {
            let Some(overlay) = hide_handle.get_webview_window(OVERLAY_LABEL) else {
                return Ok(());
            };
            overlay.hide().map_err(|error| error.to_string())?;
            Ok(())
        });
    }
}

/// OCR toolbar path: show the floating toolbar for text read from a screen region.
///
/// The caller must not be the GTK main thread — `show_toolbar` hops onto it and
/// blocks for the result. The Tauri command is declared `async` for that reason.
pub fn show_toolbar_for_snapshot(
    app: &AppHandle,
    snapshot: SelectionSnapshot,
    source_window: isize,
) -> Result<(), String> {
    SOURCE_WINDOW.store(source_window, Ordering::SeqCst);
    OVERLAY_STICKY.store(true, Ordering::SeqCst);

    show_toolbar(app, &snapshot).inspect_err(|error| {
        eprintln!("[selectmind] failed to show OCR toolbar: {error}");
    })
}

pub fn show_toolbar_from_manual(app: &AppHandle, snapshot: SelectionSnapshot, source_window: isize) {
    SOURCE_WINDOW.store(source_window, Ordering::SeqCst);
    match show_toolbar(app, &snapshot) {
        Ok(()) => {
            OVERLAY_VISIBLE.store(true, Ordering::SeqCst);
        }
        Err(error) => {
            eprintln!("[selectmind] failed to show manual toolbar: {error}");
        }
    }
}

pub fn show_toolbar(app: &AppHandle, snapshot: &SelectionSnapshot) -> Result<(), String> {
    let center_x = snapshot.x + (snapshot.width / 2).max(1);
    let center_y = snapshot.y + (snapshot.height / 2).max(1);
    let monitor = get_monitor_info_at_point(center_x, center_y)?;
    let (x, y, width, height) = positioning::toolbar_window_bounds(snapshot, &monitor);

    let payload = SelectionShowPayload {
        snapshot: snapshot.clone(),
        monitor: monitor.clone(),
    };

    let bounds = OverlayResizePayload { x, y, width, height };

    // Force a fresh ready handshake — a stale true from a previous session makes
    // us emit before the webview has re-subscribed to selection:show.
    OVERLAY_READY.store(false, Ordering::SeqCst);

    let show_handle = app.clone();
    let show_bounds = bounds.clone();
    run_on_main_thread(app, move || {
        let overlay = show_handle
            .get_webview_window(OVERLAY_LABEL)
            .ok_or_else(|| "Selection overlay window is missing".to_string())?;

        // Map first, then size — GTK often ignores set_size on an unrealized window,
        // which left an 800×600 opaque slab under the toolbar on Linux.
        overlay.show().map_err(|error| error.to_string())?;
        overlay
            .set_position(PhysicalPosition::new(show_bounds.x, show_bounds.y))
            .map_err(|error| error.to_string())?;
        force_window_size(&overlay, show_bounds.width, show_bounds.height)?;
        overlay.set_focusable(true).map_err(|error| error.to_string())?;
        set_click_through(&overlay, false);
        configure_native(false);
        let _ = show_handle.emit_to(OVERLAY_LABEL, "selection:overlay-ping", ());
        Ok(())
    })?;

    // Re-apply bounds after map; some compositors drop the first resize.
    thread::sleep(Duration::from_millis(50));
    apply_overlay_bounds(app, &bounds)?;

    // Prefer the ready handshake, but keep emitting even if it times out so a
    // late-booting webview can still receive the payload.
    let ready = wait_until_overlay_ready(Duration::from_secs(6)).is_ok();
    if !ready {
        eprintln!("[selectmind] selection overlay ready timed out — emitting anyway");
        thread::sleep(Duration::from_millis(400));
    } else {
        thread::sleep(Duration::from_millis(120));
    }

    for attempt in 0..12 {
        app.emit_to(OVERLAY_LABEL, "selection:show", &payload)
            .map_err(|error| error.to_string())?;
        thread::sleep(Duration::from_millis(if attempt < 3 { 100 } else { 50 }));
    }

    OVERLAY_VISIBLE.store(true, Ordering::SeqCst);
    Ok(())
}

fn wait_until_overlay_ready(timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    while !OVERLAY_READY.load(Ordering::SeqCst) {
        if Instant::now() >= deadline {
            return Err("Selection overlay did not load in time".to_string());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Ok(())
}

pub fn hide_overlay(app: &AppHandle) -> Result<(), String> {
    let _ = app.emit_to(OVERLAY_LABEL, "selection:hide", ());

    let hide_handle = app.clone();
    run_on_main_thread(app, move || {
        let Some(overlay) = hide_handle.get_webview_window(OVERLAY_LABEL) else {
            return Ok(());
        };
        overlay.hide().map_err(|error| error.to_string())?;
        Ok(())
    })?;

    OVERLAY_VISIBLE.store(false, Ordering::SeqCst);
    OVERLAY_STICKY.store(false, Ordering::SeqCst);
    SOURCE_WINDOW.store(0, Ordering::SeqCst);
    Ok(())
}

fn run_on_main_thread<F>(app: &AppHandle, operation: F) -> Result<(), String>
where
    F: FnOnce() -> Result<(), String> + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();

    app.run_on_main_thread(move || {
        let _ = sender.send(operation());
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv()
        .map_err(|error| format!("main thread dropped: {error}"))?
}

fn set_overlay_interactive(app: &AppHandle, interactive: bool) -> Result<(), String> {
    let handle = app.clone();
    run_on_main_thread(app, move || {
        let overlay = handle
            .get_webview_window(OVERLAY_LABEL)
            .ok_or_else(|| "Selection overlay window is missing".to_string())?;

        overlay
            .set_focusable(interactive)
            .map_err(|error| error.to_string())?;
        set_click_through(&overlay, !interactive);
        configure_native(interactive);

        if interactive {
            overlay.set_focus().map_err(|error| error.to_string())?;
        }

        Ok(())
    })
}

fn apply_overlay_bounds(app: &AppHandle, bounds: &OverlayResizePayload) -> Result<(), String> {
    let bounds = bounds.clone();
    let interactive = OVERLAY_BUSY.load(Ordering::SeqCst);
    let handle = app.clone();

    run_on_main_thread(app, move || {
        let overlay = handle
            .get_webview_window(OVERLAY_LABEL)
            .ok_or_else(|| "Selection overlay window is missing".to_string())?;

        overlay
            .set_position(PhysicalPosition::new(bounds.x, bounds.y))
            .map_err(|error| error.to_string())?;
        force_window_size(&overlay, bounds.width, bounds.height)?;
        overlay
            .set_always_on_top(true)
            .map_err(|error| error.to_string())?;
        overlay
            .set_focusable(interactive)
            .map_err(|error| error.to_string())?;
        set_click_through(&overlay, !interactive);
        configure_native(interactive);

        if interactive {
            overlay.set_focus().map_err(|error| error.to_string())?;
        }

        Ok(())
    })
}

/// GTK refuses to shrink a window below its child's minimum size (WebKitGTK
/// reports 200px) and pins WM_NORMAL_HINTS min=max to that, leaving an opaque
/// slab under the toolbar. Explicit geometry hints replace the child-derived
/// minimum, after which the WM honors the exact bounds.
fn force_window_size(overlay: &tauri::WebviewWindow, width: u32, height: u32) -> Result<(), String> {
    let size = PhysicalSize::new(width, height);
    overlay.set_size(size).map_err(|error| error.to_string())?;

    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::*;

        let scale = overlay.scale_factor().unwrap_or(1.0).max(0.5);
        let w = ((width as f64 / scale).round() as i32).max(1);
        let h = ((height as f64 / scale).round() as i32).max(1);

        let gtk_window = overlay.gtk_window().map_err(|error| error.to_string())?;
        let geometry = gdk::Geometry::new(
            w,
            h,
            w,
            h,
            0,
            0,
            0,
            0,
            0.0,
            0.0,
            gdk::Gravity::NorthWest,
        );
        gtk_window.set_geometry_hints(
            None::<&gtk::Widget>,
            Some(&geometry),
            gdk::WindowHints::MIN_SIZE | gdk::WindowHints::MAX_SIZE,
        );
        gtk_window.resize(w, h);
    }

    Ok(())
}

fn configure_native(interactive: bool) {
    let _ = OVERLAY_TITLE;
    let _ = interactive;
    #[cfg(windows)]
    {
        super::win::configure_overlay_interactive(OVERLAY_TITLE, interactive);
    }
}

/// GTK panics if click-through is applied before the GdkWindow exists.
/// On Linux the selection overlay is a compact toolbar window — an empty input
/// region makes the whole toolbar unclickable, so never ignore cursor events.
fn set_click_through(overlay: &tauri::WebviewWindow, ignore: bool) {
    #[cfg(windows)]
    {
        let _ = overlay.set_ignore_cursor_events(ignore);
    }
    #[cfg(not(windows))]
    {
        let _ = ignore;
        if overlay.is_visible().unwrap_or(false) {
            let _ = overlay.set_ignore_cursor_events(false);
        }
    }
}
