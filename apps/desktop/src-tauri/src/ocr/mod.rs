#[cfg(windows)]
mod win;

pub fn recognize_image_data_url(data_url: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        return win::recognize_data_url(data_url);
    }

    #[cfg(not(windows))]
    {
        let _ = data_url;
        Err("Windows OCR is only available on Windows".to_string())
    }
}

pub fn is_windows_ocr_available() -> bool {
    #[cfg(windows)]
    {
        return win::is_available();
    }

    #[cfg(not(windows))]
    {
        false
    }
}
