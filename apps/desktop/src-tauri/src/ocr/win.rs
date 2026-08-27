use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::io::Write;
use tempfile::NamedTempFile;
use windows::{
    core::HSTRING,
    Graphics::Imaging::BitmapDecoder,
    Media::Ocr::OcrEngine,
    Storage::{FileAccessMode, StorageFile},
};

pub fn is_available() -> bool {
    OcrEngine::TryCreateFromUserProfileLanguages().is_ok()
}

pub fn recognize_data_url(data_url: &str) -> Result<String, String> {
    let payload = data_url
        .split_once(',')
        .map(|(_, data)| data)
        .ok_or_else(|| "Invalid image data URL".to_string())?;

    let bytes = STANDARD
        .decode(payload)
        .map_err(|error| error.to_string())?;

    recognize_image_bytes(&bytes)
}

fn recognize_image_bytes(bytes: &[u8]) -> Result<String, String> {
    let mut temp = NamedTempFile::new().map_err(|error| error.to_string())?;
    temp.write_all(bytes).map_err(|error| error.to_string())?;
    temp.flush().map_err(|error| error.to_string())?;

    let path = temp
        .path()
        .to_str()
        .ok_or_else(|| "Temporary OCR path is invalid".to_string())?;

    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    let stream = file
        .OpenAsync(FileAccessMode::Read)
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|error| error.to_string())?;

    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    Ok(result
        .Text()
        .map_err(|error| error.to_string())?
        .to_string())
}
