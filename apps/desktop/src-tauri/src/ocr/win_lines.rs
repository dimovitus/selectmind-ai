//! Fast in-memory OCR with line bounding boxes — used by live game translate only.
//! Does not modify the legacy data-URL OCR path in `win.rs`.

use super::common::{OcrLineBox, OcrLinesResult};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use windows::{
    core::HSTRING,
    Foundation::Rect,
    Globalization::Language,
    Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap},
    Media::Ocr::OcrEngine,
    Storage::Streams::DataWriter,
};

/// An OCR engine plus the language tag it actually recognizes.
#[derive(Clone)]
struct ResolvedEngine {
    engine: OcrEngine,
    language: String,
}

static ENGINES: OnceLock<Mutex<HashMap<String, ResolvedEngine>>> = OnceLock::new();

fn engine_cache() -> &'static Mutex<HashMap<String, ResolvedEngine>> {
    ENGINES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn engine_language_tag(engine: &OcrEngine) -> String {
    engine
        .RecognizerLanguage()
        .and_then(|language| language.LanguageTag())
        .map(|tag| tag.to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

/// Prefer an engine for the requested language, falling back to the languages
/// installed for the current Windows user.
fn build_engine(language_tag: Option<&str>) -> Result<ResolvedEngine, String> {
    if let Some(tag) = language_tag.map(str::trim).filter(|tag| !tag.is_empty()) {
        if let Ok(language) = Language::CreateLanguage(&HSTRING::from(tag)) {
            if let Ok(engine) = OcrEngine::TryCreateFromLanguage(&language) {
                let resolved = engine_language_tag(&engine);
                return Ok(ResolvedEngine { engine, language: resolved });
            }
        }
    }

    let engine =
        OcrEngine::TryCreateFromUserProfileLanguages().map_err(|error| error.to_string())?;
    let resolved = engine_language_tag(&engine);
    Ok(ResolvedEngine { engine, language: resolved })
}

fn engine_for(language_tag: Option<&str>) -> Result<ResolvedEngine, String> {
    let key = language_tag
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();

    let mut cache = engine_cache()
        .lock()
        .map_err(|_| "OCR engine cache poisoned".to_string())?;

    if let Some(existing) = cache.get(&key) {
        return Ok(existing.clone());
    }

    let resolved = build_engine(language_tag)?;
    cache.insert(key, resolved.clone());
    Ok(resolved)
}

pub fn is_available() -> bool {
    engine_for(None).is_ok()
}

/// BCP-47 tags of OCR language packs installed for this Windows user.
pub fn list_available_languages() -> Result<Vec<String>, String> {
    let languages = OcrEngine::AvailableRecognizerLanguages().map_err(|error| error.to_string())?;
    let count = languages.Size().map_err(|error| error.to_string())?;
    let mut tags = Vec::with_capacity(count as usize);

    for index in 0..count {
        let language = languages
            .GetAt(index)
            .map_err(|error| error.to_string())?;
        if let Ok(tag) = language.LanguageTag() {
            let value = tag.to_string();
            if !value.is_empty() {
                tags.push(value);
            }
        }
    }

    tags.sort();
    tags.dedup();
    Ok(tags)
}

fn encode_bgra(rgba: &[u8]) -> Vec<u8> {
    let mut bgra = Vec::with_capacity(rgba.len());
    for pixel in rgba.chunks_exact(4) {
        bgra.extend_from_slice(&[pixel[2], pixel[1], pixel[0], pixel[3]]);
    }
    bgra
}

/// Build a SoftwareBitmap directly from pixels — no PNG encode/decode round-trip.
fn bitmap_from_rgba(rgba: &[u8], width: u32, height: u32) -> Result<SoftwareBitmap, String> {
    let bgra = encode_bgra(rgba);
    let writer = DataWriter::new().map_err(|error| error.to_string())?;
    writer
        .WriteBytes(&bgra)
        .map_err(|error| error.to_string())?;
    let buffer = writer
        .DetachBuffer()
        .map_err(|error| error.to_string())?;

    SoftwareBitmap::CreateCopyFromBuffer(
        &buffer,
        BitmapPixelFormat::Bgra8,
        width as i32,
        height as i32,
    )
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

pub fn recognize_rgba_lines(
    rgba: &[u8],
    width: u32,
    height: u32,
    language_tag: Option<&str>,
) -> Result<OcrLinesResult, String> {
    let resolved = engine_for(language_tag)?;
    if width == 0 || height == 0 {
        return Ok(OcrLinesResult {
            lines: Vec::new(),
            language: resolved.language,
        });
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
    let result = resolved
        .engine
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

    Ok(OcrLinesResult {
        lines: output,
        language: resolved.language,
    })
}

#[allow(dead_code)]
pub fn recognize_rgba_text(rgba: &[u8], width: u32, height: u32) -> Result<String, String> {
    let result = recognize_rgba_lines(rgba, width, height, None)?;
    Ok(result
        .lines
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
        let result = recognize_rgba_lines(&[], 0, 0, None);
        if let Ok(value) = result {
            assert!(value.lines.is_empty());
        }
    }
}
