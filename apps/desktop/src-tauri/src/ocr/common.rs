use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLineBox {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub struct OcrLinesResult {
    pub lines: Vec<OcrLineBox>,
    pub language: String,
}

/// Drop OCR hits on visually flat regions (gradients / blank boxes) before translate.
const MIN_LINE_LUMA_RANGE: u32 = 18;

pub fn filter_low_contrast_lines(
    rgba: &[u8],
    width: u32,
    height: u32,
    lines: Vec<OcrLineBox>,
) -> Vec<OcrLineBox> {
    lines
        .into_iter()
        .filter(|line| line_has_contrast(rgba, width, height, line))
        .collect()
}

fn line_has_contrast(rgba: &[u8], width: u32, height: u32, line: &OcrLineBox) -> bool {
    if width == 0 || height == 0 {
        return true;
    }

    let x0 = line.x.floor().max(0.0) as u32;
    let y0 = line.y.floor().max(0.0) as u32;
    let x1 = (line.x + line.width).ceil().min(width as f64) as u32;
    let y1 = (line.y + line.height).ceil().min(height as f64) as u32;

    if x1 <= x0 + 1 || y1 <= y0 + 1 {
        return true;
    }

    let mut min_luma = u32::MAX;
    let mut max_luma = 0u32;
    let step = 4u32;

    let mut y = y0;
    while y < y1 {
        let mut x = x0;
        while x < x1 {
            let idx = ((y * width + x) * 4) as usize;
            if idx + 2 < rgba.len() {
                let luma =
                    (u32::from(rgba[idx]) + u32::from(rgba[idx + 1]) + u32::from(rgba[idx + 2]))
                        / 3;
                min_luma = min_luma.min(luma);
                max_luma = max_luma.max(luma);
            }
            x = x.saturating_add(step);
        }
        y = y.saturating_add(step);
    }

    if min_luma == u32::MAX {
        return true;
    }

    max_luma.saturating_sub(min_luma) >= MIN_LINE_LUMA_RANGE
}

#[cfg(test)]
mod tests {
    use super::{filter_low_contrast_lines, OcrLineBox};

    #[test]
    fn contrast_filter_drops_flat_regions() {
        let width = 40u32;
        let height = 20u32;
        let mut rgba = vec![128u8; (width * height * 4) as usize];
        for y in 0..8 {
            for x in 0..20 {
                let idx = ((y * width + x) * 4) as usize;
                let luma = if x < 10 { 20u8 } else { 220u8 };
                rgba[idx] = luma;
                rgba[idx + 1] = luma;
                rgba[idx + 2] = luma;
                rgba[idx + 3] = 255;
            }
        }

        let lines = vec![
            OcrLineBox {
                text: "flat".to_string(),
                x: 20.0,
                y: 12.0,
                width: 10.0,
                height: 6.0,
            },
            OcrLineBox {
                text: "text".to_string(),
                x: 0.0,
                y: 0.0,
                width: 18.0,
                height: 8.0,
            },
        ];

        let filtered = filter_low_contrast_lines(&rgba, width, height, lines);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].text, "text");
    }
}
