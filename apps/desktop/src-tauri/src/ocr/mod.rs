mod common;

#[cfg(windows)]
mod win;

#[cfg(windows)]
mod win_lines;

#[cfg(not(windows))]
mod tesseract;

pub mod lines {
    pub use crate::ocr::common::{filter_low_contrast_lines, OcrLineBox, OcrLinesResult};

    #[cfg(windows)]
    pub use crate::ocr::win_lines::{is_available, list_available_languages, recognize_rgba_lines};

    #[cfg(not(windows))]
    pub use crate::ocr::tesseract::{is_available, list_available_languages, recognize_rgba_lines};
}

pub fn recognize_image_data_url(data_url: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        return win::recognize_data_url(data_url);
    }

    #[cfg(not(windows))]
    {
        tesseract::recognize_data_url(data_url)
    }
}

pub fn is_available() -> bool {
    lines::is_available()
}

pub fn list_ocr_languages() -> Result<Vec<String>, String> {
    lines::list_available_languages()
}
