//! Tesseract CLI OCR with word/line boxes — Linux (and other non-Windows) live translate.

use super::common::{OcrLineBox, OcrLinesResult};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{ImageEncoder, RgbaImage};
use leptess::{LepTess, Variable};
use std::io::Write;
use std::process::Command;
use std::sync::{Mutex, OnceLock};

/// Tesseract slows down roughly linearly per extra language.
const MAX_AUTO_LANGUAGES: usize = 4;

struct EngineSlot {
    lang: String,
    api: LepTess,
}

static ENGINE: OnceLock<Mutex<Option<EngineSlot>>> = OnceLock::new();

fn engine_slot() -> &'static Mutex<Option<EngineSlot>> {
    ENGINE.get_or_init(|| Mutex::new(None))
}

pub fn is_available() -> bool {
    Command::new("tesseract")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// BCP-47-ish tags (en, ru, ja…) for the settings UI.
pub fn list_available_languages() -> Result<Vec<String>, String> {
    let output = Command::new("tesseract")
        .arg("--list-langs")
        .output()
        .map_err(|error| format!("tesseract is not installed: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("tesseract --list-langs failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}\n{stderr}");

    let mut tags: Vec<String> = combined
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| !line.to_ascii_lowercase().starts_with("list of available"))
        .filter(|line| *line != "osd")
        .map(tesseract_code_to_bcp47)
        .filter(|tag| !tag.is_empty())
        .collect();

    tags.sort();
    tags.dedup();
    Ok(tags)
}

pub fn recognize_data_url(data_url: &str) -> Result<String, String> {
    let payload = data_url
        .split_once(',')
        .map(|(_, data)| data)
        .ok_or_else(|| "Invalid image data URL".to_string())?;

    let bytes = STANDARD
        .decode(payload)
        .map_err(|error| error.to_string())?;

    let mut temp = tempfile::Builder::new()
        .suffix(".png")
        .tempfile()
        .map_err(|error| error.to_string())?;
    temp.write_all(&bytes).map_err(|error| error.to_string())?;
    temp.flush().map_err(|error| error.to_string())?;

    let output = run_tesseract(
        temp.path()
            .to_str()
            .ok_or_else(|| "Temporary OCR path is invalid".to_string())?,
        auto_languages(),
        "txt",
    )?;
    Ok(output.trim().to_string())
}

/// The toolbar OCR has no language setting, and Tesseract silently defaults to
/// English — which returns nothing for Cyrillic or CJK. Recognise with every
/// installed traineddata instead.
fn auto_languages() -> Option<&'static str> {
    static LANGUAGES: OnceLock<Option<String>> = OnceLock::new();

    LANGUAGES
        .get_or_init(|| {
            let output = Command::new("tesseract").arg("--list-langs").output().ok()?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            let mut codes: Vec<String> = format!("{stdout}\n{stderr}")
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .filter(|line| !line.to_ascii_lowercase().starts_with("list of available"))
                .filter(|line| *line != "osd")
                .map(str::to_string)
                .collect();
            codes.sort();
            codes.dedup();

            // Latin script first: it is the most common and the cheapest to score.
            codes.sort_by_key(|code| code != "eng");
            codes.truncate(MAX_AUTO_LANGUAGES);

            (!codes.is_empty()).then(|| codes.join("+"))
        })
        .as_deref()
}

pub fn recognize_rgba_lines(
    rgba: &[u8],
    width: u32,
    height: u32,
    language_tag: Option<&str>,
) -> Result<OcrLinesResult, String> {
    let tess_lang = resolve_tesseract_lang_arg(language_tag);

    if width == 0 || height == 0 {
        return Ok(OcrLinesResult {
            lines: Vec::new(),
            language: tess_lang.clone().unwrap_or_else(|| "eng".to_string()),
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

    let image = RgbaImage::from_raw(width, height, rgba.to_vec())
        .ok_or_else(|| "Failed to build OCR image from RGBA buffer".to_string())?;

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

    let language = tess_lang
        .clone()
        .unwrap_or_else(|| "eng".to_string());

    // Prefer in-process Tesseract (no CLI spawn / no tempfile). Fall back to CLI
    // if the bindings fail on this host.
    let lines = match recognize_in_process(&png_bytes, &language) {
        Ok(lines) => lines,
        Err(in_process_error) => {
            eprintln!(
                "[selectmind] in-process OCR failed ({in_process_error}); falling back to CLI"
            );
            let mut temp = tempfile::Builder::new()
                .suffix(".png")
                .tempfile()
                .map_err(|error| error.to_string())?;
            temp.write_all(&png_bytes)
                .map_err(|error| error.to_string())?;
            temp.flush().map_err(|error| error.to_string())?;
            let tsv = run_tesseract(
                temp.path()
                    .to_str()
                    .ok_or_else(|| "Temporary OCR path is invalid".to_string())?,
                Some(language.as_str()),
                "tsv",
            )?;
            parse_tsv_lines(&tsv)
        }
    };

    Ok(OcrLinesResult {
        language,
        lines,
    })
}

fn recognize_in_process(png_bytes: &[u8], language: &str) -> Result<Vec<OcrLineBox>, String> {
    let mut guard = engine_slot()
        .lock()
        .map_err(|_| "OCR engine lock poisoned".to_string())?;

    let needs_init = guard
        .as_ref()
        .map(|slot| slot.lang != language)
        .unwrap_or(true);

    if needs_init {
        let mut api = LepTess::new(None, language)
            .map_err(|error| format!("LepTess init ({language}): {error}"))?;
        let _ = api.set_variable(Variable::TesseditPagesegMode, "11");
        *guard = Some(EngineSlot {
            lang: language.to_string(),
            api,
        });
    }

    let slot = guard
        .as_mut()
        .ok_or_else(|| "OCR engine missing after init".to_string())?;

    slot.api
        .set_image_from_mem(png_bytes)
        .map_err(|error| format!("set_image_from_mem: {error}"))?;
    slot.api.set_source_resolution(72);

    let tsv = slot
        .api
        .get_tsv_text(0)
        .map_err(|error| format!("get_tsv_text: {error}"))?;

    Ok(parse_tsv_lines(&tsv))
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

fn run_tesseract(image_path: &str, language: Option<&str>, output_kind: &str) -> Result<String, String> {
    if !is_available() {
        return Err(
            "Tesseract is not installed. On Arch: pacman -S tesseract tesseract-data-eng tesseract-data-rus"
                .to_string(),
        );
    }

    // Prefer an explicit language; bare None stays eng (never mixed packs).
    let lang = language
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "eng".to_string());

    let mut command = Command::new("tesseract");
    command
        .arg(image_path)
        .arg("stdout")
        .arg("--psm")
        .arg("11")
        .arg("-l")
        .arg(&lang);
    if output_kind == "tsv" {
        command.arg("tsv");
    }

    let output = command
        .output()
        .map_err(|error| format!("Failed to run tesseract: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        // Multi-lang packs sometimes fail; retry with eng only once.
        if lang.contains('+') {
            return run_tesseract(image_path, Some("eng"), output_kind);
        }
        return Err(if stderr.is_empty() {
            "tesseract failed".to_string()
        } else {
            stderr
        });
    }

    String::from_utf8(output.stdout).map_err(|error| error.to_string())
}

/// Map UI language tag → Tesseract `-l` value.
///
/// Game UI is sparse labels in one script. Mixed `eng+rus` forces alphabet
/// guessing (`BACK` → `BACH`). Live translate always passes an explicit source
/// tag; bare `None` stays `eng` (not every installed pack).
fn resolve_tesseract_lang_arg(language_tag: Option<&str>) -> Option<String> {
    let code = language_tag
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
        .map(bcp47_to_tesseract);

    match code.as_deref() {
        None => Some("eng".to_string()),
        Some(other) => Some(other.to_string()),
    }
}

/// `--psm 11` (sparse text) finds floating UI labels without forcing one block.
/// Neighbouring words still merge when closer than this gap multiple of height.
const LINE_SPLIT_GAP_RATIO: f64 = 1.2;
const MIN_LINE_SPLIT_GAP_PX: f64 = 10.0;
/// Below this Tesseract confidence a "word" is almost always noise ("юя", "——").
const MIN_WORD_CONFIDENCE: f64 = 25.0;

/// Tesseract TSV: group level-5 words into lines by (block, par, line), then
/// split each line wherever a wide horizontal gap separates two labels.
pub fn parse_tsv_lines(tsv: &str) -> Vec<OcrLineBox> {
    let mut lines: Vec<(i32, i32, i32, OcrLineBox)> = Vec::new();
    let mut previous_right: Option<f64> = None;

    for raw in tsv.lines().skip(1) {
        let columns: Vec<&str> = raw.split('\t').collect();
        if columns.len() < 12 {
            continue;
        }
        let Ok(level) = columns[0].parse::<i32>() else {
            continue;
        };
        if level != 5 {
            continue;
        }
        let Ok(block) = columns[2].parse::<i32>() else {
            continue;
        };
        let Ok(par) = columns[3].parse::<i32>() else {
            continue;
        };
        let Ok(line) = columns[4].parse::<i32>() else {
            continue;
        };
        let Ok(left) = columns[6].parse::<f64>() else {
            continue;
        };
        let Ok(top) = columns[7].parse::<f64>() else {
            continue;
        };
        let Ok(width) = columns[8].parse::<f64>() else {
            continue;
        };
        let Ok(height) = columns[9].parse::<f64>() else {
            continue;
        };
        if columns[10]
            .parse::<f64>()
            .is_ok_and(|confidence| confidence < MIN_WORD_CONFIDENCE)
        {
            continue;
        }
        let text = columns[11].trim();
        if text.is_empty() {
            continue;
        }

        let gap_limit = (height * LINE_SPLIT_GAP_RATIO).max(MIN_LINE_SPLIT_GAP_PX);
        let continues_label = previous_right.is_some_and(|right| left - right <= gap_limit);

        if let Some(existing) = lines
            .last_mut()
            .filter(|(b, p, l, _)| *b == block && *p == par && *l == line)
            .filter(|_| continues_label)
        {
            let box_ = &mut existing.3;
            let right = (box_.x + box_.width).max(left + width);
            let bottom = (box_.y + box_.height).max(top + height);
            box_.x = box_.x.min(left);
            box_.y = box_.y.min(top);
            box_.width = (right - box_.x).max(1.0);
            box_.height = (bottom - box_.y).max(12.0);
            box_.text.push(' ');
            box_.text.push_str(text);
        } else {
            lines.push((
                block,
                par,
                line,
                OcrLineBox {
                    text: text.to_string(),
                    x: left,
                    y: top,
                    width: width.max(1.0),
                    height: height.max(12.0),
                },
            ));
        }

        previous_right = Some(left + width);
    }

    lines.into_iter().map(|(_, _, _, line)| line).collect()
}

pub fn bcp47_to_tesseract(tag: &str) -> String {
    let base = tag
        .split(['-', '_'])
        .next()
        .unwrap_or(tag)
        .to_ascii_lowercase();
    match base.as_str() {
        "en" => "eng".to_string(),
        "ru" => "rus".to_string(),
        "uk" => "ukr".to_string(),
        "ja" => "jpn".to_string(),
        "zh" => "chi_sim".to_string(),
        "de" => "deu".to_string(),
        "fr" => "fra".to_string(),
        "es" => "spa".to_string(),
        "it" => "ita".to_string(),
        "pt" => "por".to_string(),
        "ko" => "kor".to_string(),
        "pl" => "pol".to_string(),
        "tr" => "tur".to_string(),
        "ar" => "ara".to_string(),
        "nl" => "nld".to_string(),
        "sv" => "swe".to_string(),
        "cs" => "ces".to_string(),
        other => other.to_string(),
    }
}

pub fn tesseract_code_to_bcp47(code: &str) -> String {
    match code.trim().to_ascii_lowercase().as_str() {
        "eng" => "en".to_string(),
        "rus" => "ru".to_string(),
        "ukr" => "uk".to_string(),
        "jpn" => "ja".to_string(),
        "chi_sim" | "chi_tra" => "zh".to_string(),
        "deu" => "de".to_string(),
        "fra" => "fr".to_string(),
        "spa" => "es".to_string(),
        "ita" => "it".to_string(),
        "por" => "pt".to_string(),
        "kor" => "ko".to_string(),
        "pol" => "pl".to_string(),
        "tur" => "tr".to_string(),
        "ara" => "ar".to_string(),
        "nld" => "nl".to_string(),
        "swe" => "sv".to_string(),
        "ces" => "cs".to_string(),
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{bcp47_to_tesseract, parse_tsv_lines, tesseract_code_to_bcp47};

    #[test]
    fn maps_bcp47_to_tesseract_codes() {
        assert_eq!(bcp47_to_tesseract("en"), "eng");
        assert_eq!(bcp47_to_tesseract("ru-RU"), "rus");
        assert_eq!(bcp47_to_tesseract("ja"), "jpn");
    }

    #[test]
    fn maps_tesseract_codes_to_bcp47() {
        assert_eq!(tesseract_code_to_bcp47("eng"), "en");
        assert_eq!(tesseract_code_to_bcp47("rus"), "ru");
    }

    #[test]
    fn parse_tsv_groups_words_into_lines() {
        let tsv = "\
level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
5\t1\t1\t1\t1\t1\t10\t10\t40\t16\t95\tHello
5\t1\t1\t1\t1\t2\t54\t10\t38\t16\t92\tworld
5\t1\t1\t1\t2\t1\t10\t30\t50\t16\t90\tLine
";
        let lines = parse_tsv_lines(tsv);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].text, "Hello world");
        assert_eq!(lines[0].x, 10.0);
        assert_eq!(lines[0].width, 82.0);
        assert_eq!(lines[1].text, "Line");
    }

    #[test]
    fn splits_one_row_into_separate_labels_on_wide_gaps() {
        let tsv = "\
level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
5\t1\t1\t1\t1\t1\t10\t10\t60\t16\t95\tSTART
5\t1\t1\t1\t1\t2\t900\t10\t80\t16\t93\tQUIT
";
        let lines = parse_tsv_lines(tsv);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].text, "START");
        assert_eq!(lines[0].width, 60.0);
        assert_eq!(lines[1].text, "QUIT");
        assert_eq!(lines[1].x, 900.0);
    }

    #[test]
    fn drops_low_confidence_noise() {
        let tsv = "\
level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
5\t1\t1\t1\t1\t1\t10\t10\t40\t16\t95\tSave
5\t1\t1\t1\t1\t2\t52\t10\t6\t16\t3\t——
5\t1\t1\t1\t1\t3\t62\t10\t40\t16\t91\tfile
";
        let lines = parse_tsv_lines(tsv);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "Save file");
    }
}
