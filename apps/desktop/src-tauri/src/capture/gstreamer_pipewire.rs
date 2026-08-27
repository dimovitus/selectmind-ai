//! Continuous Linux capture via GStreamer `pipewiresrc`.
//!
//! Portal ScreenCast gives us a PipeWire FD + node id. GStreamer loads
//! `libpipewire` dynamically inside the plugin — we never link PipeWire C
//! headers (the xcap failure mode on ≥1.4).
//!
//! Runtime requirement: `gst-plugin-pipewire` (Arch: `extra/gst-plugin-pipewire`).

use std::path::Path;
use std::os::fd::AsRawFd;
use std::sync::Mutex;
use std::time::Duration;

use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app::{AppSink, AppSinkCallbacks};
use image::RgbaImage;

use super::screencast::{self, ScreencastRemote};

struct ActiveCapture {
    _remote: ScreencastRemote,
    pipeline: gst::Pipeline,
    appsink: AppSink,
}

static CAPTURE: Mutex<Option<ActiveCapture>> = Mutex::new(None);
static GST_READY: Mutex<Option<bool>> = Mutex::new(None);

fn pipewire_plugin_on_disk() -> bool {
    const CANDIDATES: &[&str] = &[
        "/usr/lib/gstreamer-1.0/libgstpipewire.so",
        "/usr/lib64/gstreamer-1.0/libgstpipewire.so",
        "/usr/lib/x86_64-linux-gnu/gstreamer-1.0/libgstpipewire.so",
    ];
    CANDIDATES.iter().any(|path| Path::new(path).exists())
}

fn ensure_gst_with_pipewire() -> bool {
    if gst::init().is_err() {
        return false;
    }
    if gst::ElementFactory::find("pipewiresrc").is_some() {
        return true;
    }
    // Tauri / sandboxed launches sometimes miss the system plugin path.
    for path in [
        "/usr/lib/gstreamer-1.0",
        "/usr/lib64/gstreamer-1.0",
        "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
    ] {
        let _ = gst::Registry::get().scan_path(path);
    }
    gst::ElementFactory::find("pipewiresrc").is_some() || pipewire_plugin_on_disk()
}

/// True when Continuous mode can open a PipeWire stream (plugin present).
pub fn is_available() -> bool {
    let mut guard = GST_READY.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(ready) = *guard {
        return ready;
    }
    let ready = ensure_gst_with_pipewire();
    *guard = Some(ready);
    ready
}

pub fn is_streaming() -> bool {
    CAPTURE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .is_some()
}

/// Negotiate ScreenCast + start the GStreamer pipeline. Shows a share dialog once.
pub fn start_stream() -> Result<(), String> {
    if !ensure_gst_with_pipewire() {
        return Err(
            "Continuous capture needs GStreamer pipewiresrc. Install gst-plugin-pipewire \
             (Arch: pacman -S gst-plugin-pipewire), then restart the app."
                .into(),
        );
    }
    // Refresh cached probe after a successful ensure.
    if let Ok(mut guard) = GST_READY.lock() {
        *guard = Some(true);
    }

    stop_stream();

    let remote = screencast::open_monitor_stream(Duration::from_secs(120))?;
    let capture = build_pipeline(remote)?;
    let mut guard = CAPTURE
        .lock()
        .map_err(|_| "continuous capture lock poisoned".to_string())?;
    *guard = Some(capture);
    eprintln!("[selectmind] continuous capture: GStreamer pipewiresrc streaming");
    Ok(())
}

pub fn stop_stream() {
    let mut guard = CAPTURE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(active) = guard.take() {
        let _ = active.pipeline.set_state(gst::State::Null);
        eprintln!("[selectmind] continuous capture: stream stopped");
    }
}

/// Pull the newest RGBA frame from the live stream, if one is running.
pub fn try_grab_rgba() -> Option<RgbaImage> {
    let guard = CAPTURE.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let active = guard.as_ref()?;
    match pull_rgba_frame(&active.appsink) {
        Ok(frame) => Some(frame),
        Err(error) => {
            eprintln!("[selectmind] continuous capture pull failed: {error}");
            None
        }
    }
}

fn build_pipeline(remote: ScreencastRemote) -> Result<ActiveCapture, String> {
    gst::init().map_err(|error| format!("gstreamer init failed: {error}"))?;

    let fd = remote.fd.as_raw_fd();
    let path = remote.node_id.to_string();

    let src = gst::ElementFactory::make("pipewiresrc")
        .name("sm_pwsrc")
        .property("fd", fd)
        .property("path", &path)
        .property("always-copy", true)
        .build()
        .map_err(|_| {
            "Failed to create pipewiresrc — is gst-plugin-pipewire installed?".to_string()
        })?;

    let convert = gst::ElementFactory::make("videoconvert")
        .name("sm_convert")
        .build()
        .map_err(|_| "Failed to create videoconvert".to_string())?;

    let sink = gst::ElementFactory::make("appsink")
        .name("sm_sink")
        .build()
        .map_err(|_| "Failed to create appsink".to_string())?;

    let appsink = sink
        .clone()
        .dynamic_cast::<AppSink>()
        .map_err(|_| "appsink element cast failed".to_string())?;
    appsink.set_property("drop", true);
    appsink.set_property("max-buffers", 1u32);
    appsink.set_caps(Some(
        &gst::Caps::builder("video/x-raw")
            .field("format", "RGBA")
            .build(),
    ));
    // Avoid callbacks — we pull from the live tick thread.
    appsink.set_callbacks(AppSinkCallbacks::builder().build());

    let pipeline = gst::Pipeline::default();
    pipeline
        .add_many([&src, &convert, &sink])
        .map_err(|error| format!("pipeline add failed: {error}"))?;
    gst::Element::link_many([&src, &convert, &sink])
        .map_err(|_| "Failed to link pipewiresrc ! videoconvert ! appsink".to_string())?;

    pipeline
        .set_state(gst::State::Playing)
        .map_err(|error| format!("pipeline PLAYING failed: {error}"))?;

    // Wait briefly for the first buffers so the first live tick is not empty.
    let (_state_res, state, _pending) =
        pipeline.state(gst::ClockTime::from_seconds(3));
    if state != gst::State::Playing {
        let _ = pipeline.set_state(gst::State::Null);
        return Err(format!(
            "GStreamer pipeline did not reach PLAYING (state={state:?})"
        ));
    }

    Ok(ActiveCapture {
        _remote: remote,
        pipeline,
        appsink,
    })
}

fn pull_rgba_frame(appsink: &AppSink) -> Result<RgbaImage, String> {
    let sample = appsink
        .try_pull_sample(gst::ClockTime::from_mseconds(500))
        .ok_or_else(|| "No frame from pipewiresrc within 500ms".to_string())?;

    let caps = sample
        .caps()
        .ok_or_else(|| "Sample has no caps".to_string())?;
    let structure = caps
        .structure(0)
        .ok_or_else(|| "Sample caps are empty".to_string())?;
    let width = structure
        .get::<i32>("width")
        .map_err(|error| format!("width: {error}"))? as u32;
    let height = structure
        .get::<i32>("height")
        .map_err(|error| format!("height: {error}"))? as u32;
    if width == 0 || height == 0 {
        return Err("Invalid frame size from pipewiresrc".to_string());
    }

    let buffer = sample
        .buffer()
        .ok_or_else(|| "Sample has no buffer".to_string())?;
    let map = buffer
        .map_readable()
        .map_err(|error| format!("buffer map failed: {error}"))?;
    let expected = (width as usize)
        .checked_mul(height as usize)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| "Frame size overflow".to_string())?;
    if map.len() < expected {
        return Err(format!(
            "Frame buffer too small: got {} want {expected}",
            map.len()
        ));
    }

    let mut rgba = map.as_slice()[..expected].to_vec();
    // Ensure opaque alpha for OCR backends that discard transparent pixels.
    for pixel in rgba.chunks_exact_mut(4) {
        pixel[3] = 255;
    }

    RgbaImage::from_raw(width, height, rgba)
        .ok_or_else(|| "Failed to build RgbaImage from GStreamer buffer".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn availability_probe_does_not_panic() {
        let _ = is_available();
        assert!(!is_streaming());
    }
}
