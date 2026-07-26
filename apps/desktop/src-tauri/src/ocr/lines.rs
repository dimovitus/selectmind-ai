//! Fast in-memory OCR with line bounding boxes — used by live game translate only.
//! Does not modify the legacy data-URL OCR path in `win.rs`.

use image::ImageEncoder;
use serde::Serialize;
use std::sync::OnceLock;
use windows::{
    Foundation::Rect,
    Graphics::Imaging::BitmapDecoder,
    Media::Ocr::OcrEngine,
    Storage::Streams::{DataWriter, InMemoryRandomAccessStream},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLineBox {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

static ENGINE: OnceLock<Result<OcrEngine, String>> = OnceLock::new();

fn engine() -> Result<&'static OcrEngine, String> {
    ENGINE
        .get_or_init(|| {
            OcrEngine::TryCreateFromUserProfileLanguages()
                .map_err(|error| error.to_string())
        })
        .as_ref()
        .map_err(|error| error.clone())
}

pub fn is_available() -> bool {
    engine().is_ok()
}

fn encode_png(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut png_bytes = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
    encoder
        .write_image(
            rgba,
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|error| error.to_string())?;
    Ok(png_bytes)
}

fn bitmap_from_rgba(rgba: &[u8], width: u32, height: u32) -> Result<windows::Graphics::Imaging::SoftwareBitmap, String> {
    let png_bytes = encode_png(rgba, width, height)?;
    let stream = InMemoryRandomAccessStream::new().map_err(|error| error.to_string())?;
    let writer = DataWriter::CreateDataWriter(&stream).map_err(|error| error.to_string())?;
    writer
        .WriteBytes(&png_bytes)
        .map_err(|error| error.to_string())?;
    writer
        .StoreAsync()
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;
    writer
        .FlushAsync()
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;
    writer
        .DetachStream()
        .map_err(|error| error.to_string())?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    decoder
        .GetSoftwareBitmapAsync()
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())
}

fn rect_union(current: Option<Rect>, next: Rect) -> Rect {
    match current {
        None => next,
        Some(existing) => {
            let left = existing.X.min(next.X);
            let top = existing.Y.min(next.Y);
            let right = (existing.X + existing.Width).max(next.X + next.Width);
            let bottom = (existing.Y + existing.Height).max(next.Y + next.Height);
            Rect {
                X: left,
                Y: top,
                Width: (right - left).max(0.0),
                Height: (bottom - top).max(0.0),
            }
        }
    }
}

fn rect_to_f64(rect: Rect) -> (f64, f64, f64, f64) {
    (
        rect.X as f64,
        rect.Y as f64,
        rect.Width as f64,
        rect.Height as f64,
    )
}

pub fn recognize_rgba_lines(rgba: &[u8], width: u32, height: u32) -> Result<Vec<OcrLineBox>, String> {
    if width == 0 || height == 0 {
        return Ok(Vec::new());
    }

    let expected = (width as usize)
        .checked_mul(height as usize)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| "OCR image dimensions overflow".to_string())?;

    if rgba.len() != expected {
        return Err(format!(
            "OCR buffer size mismatch: expected {expected} bytes, got {}",
            rgba.len()
        ));
    }

    let bitmap = bitmap_from_rgba(rgba, width, height)?;
    let engine = engine()?;
    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    let lines = result.Lines().map_err(|error| error.to_string())?;
    let line_count = lines.Size().map_err(|error| error.to_string())?;
    let mut output = Vec::new();

    for index in 0..line_count {
        let line = lines.GetAt(index).map_err(|error| error.to_string())?;
        let text = line
            .Text()
            .map_err(|error| error.to_string())?
            .to_string()
            .trim()
            .to_string();

        if text.is_empty() {
            continue;
        }

        let words = line.Words().map_err(|error| error.to_string())?;
        let word_count = words.Size().map_err(|error| error.to_string())?;
        let mut bounds: Option<Rect> = None;

        for word_index in 0..word_count {
            let word = words
                .GetAt(word_index)
                .map_err(|error| error.to_string())?;
            let rect = word
                .BoundingRect()
                .map_err(|error| error.to_string())?;
            bounds = Some(rect_union(bounds, rect));
        }

        let Some(bounds) = bounds else {
            output.push(OcrLineBox {
                text,
                x: 0.0,
                y: 0.0,
                width: width as f64,
                height: (height as f64 / line_count.max(1) as f64).max(12.0),
            });
            continue;
        };

        let (x, y, w, h) = rect_to_f64(bounds);
        output.push(OcrLineBox {
            text,
            x,
            y,
            width: w.max(1.0),
            height: h.max(12.0),
        });
    }

    Ok(output)
}

#[allow(dead_code)]
pub fn recognize_rgba_text(rgba: &[u8], width: u32, height: u32) -> Result<String, String> {
    let lines = recognize_rgba_lines(rgba, width, height)?;
    Ok(lines
        .into_iter()
        .map(|line| line.text)
        .collect::<Vec<_>>()
        .join("\n"))
}

#[cfg(test)]
mod tests {
    use super::recognize_rgba_lines;

    #[test]
    fn empty_buffer_returns_empty_lines() {
        assert!(recognize_rgba_lines(&[], 0, 0).unwrap().is_empty());
    }
}
