mod catalog;

use catalog::{find_by_id, find_by_pair, CatalogEntry};
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const USER_AGENT_VALUE: &str = "SelectMind-Desktop/0.2";
const MODEL_FILE_EXTENSION: &str = "argosmodel";

static DOWNLOAD_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn download_lock() -> &'static Mutex<()> {
    DOWNLOAD_LOCK.get_or_init(|| Mutex::new(()))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelListItem {
    pub id: String,
    pub from_code: String,
    pub from_name: String,
    pub to_code: String,
    pub to_name: String,
    pub package_version: String,
    pub download_url: String,
    pub size_bytes: u64,
    pub installed: bool,
    pub installed_size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsListResult {
    pub models_dir: String,
    pub total_installed_bytes: u64,
    pub items: Vec<ModelListItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub id: String,
    pub installed: bool,
    pub path: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub phase: String,
    pub message: Option<String>,
}

pub fn models_root() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "APPDATA environment variable is not set".to_string())?;
        return Ok(PathBuf::from(appdata).join("SelectMind").join("models"));
    }

    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME environment variable is not set".to_string())?;
        Ok(PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("SelectMind")
            .join("models"))
    }
}

pub fn model_file_path(model_id: &str) -> Result<PathBuf, String> {
    let root = models_root()?;
    Ok(root.join(format!("{model_id}.{MODEL_FILE_EXTENSION}")))
}

pub fn is_installed(model_id: &str) -> bool {
    model_file_path(model_id)
        .ok()
        .is_some_and(|path| path.is_file())
}

pub fn is_pair_installed(from_code: &str, to_code: &str) -> bool {
    find_by_pair(from_code, to_code).is_some_and(|entry| is_installed(entry.id))
}

pub fn installed_size(model_id: &str) -> Option<u64> {
    let path = model_file_path(model_id).ok()?;
    if path.is_file() {
        path.metadata().ok().map(|meta| meta.len())
    } else {
        None
    }
}

pub fn ensure_models_dir() -> Result<PathBuf, String> {
    let root = models_root()?;
    fs::create_dir_all(&root).map_err(|error| format!("Failed to create models directory: {error}"))?;
    Ok(root)
}

fn total_installed_bytes(root: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(root) else {
        return 0;
    };

    entries
        .filter_map(Result::ok)
        .filter_map(|entry| entry.metadata().ok())
        .filter(|meta| meta.is_file())
        .map(|meta| meta.len())
        .sum()
}

fn catalog_item(entry: &CatalogEntry) -> ModelListItem {
    let installed = is_installed(entry.id);
    ModelListItem {
        id: entry.id.to_string(),
        from_code: entry.from_code.to_string(),
        from_name: entry.from_name.to_string(),
        to_code: entry.to_code.to_string(),
        to_name: entry.to_name.to_string(),
        package_version: entry.package_version.to_string(),
        download_url: entry.download_url.to_string(),
        size_bytes: entry.size_bytes,
        installed,
        installed_size_bytes: if installed {
            installed_size(entry.id)
        } else {
            None
        },
    }
}

pub fn list_models() -> Result<ModelsListResult, String> {
    let root = ensure_models_dir()?;
    let items = catalog::catalog()
        .iter()
        .map(catalog_item)
        .collect::<Vec<_>>();

    Ok(ModelsListResult {
        models_dir: root.display().to_string(),
        total_installed_bytes: total_installed_bytes(&root),
        items,
    })
}

pub fn model_status(model_id: &str) -> Result<ModelStatus, String> {
    let entry = find_by_id(model_id).ok_or_else(|| format!("Unknown model id: {model_id}"))?;
    let installed = is_installed(entry.id);
    Ok(ModelStatus {
        id: entry.id.to_string(),
        installed,
        path: if installed {
            Some(model_file_path(entry.id)?.display().to_string())
        } else {
            None
        },
        size_bytes: if installed {
            installed_size(entry.id)
        } else {
            None
        },
    })
}

fn http_client() -> Result<Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));

    Client::builder()
        .timeout(Duration::from_secs(600))
        .default_headers(headers)
        .build()
        .map_err(|error| error.to_string())
}

fn emit_progress(app: &AppHandle, progress: ModelDownloadProgress) {
    let _ = app.emit("model-download-progress", progress);
}

pub fn download_model(app: AppHandle, model_id: String) -> Result<ModelStatus, String> {
    let _guard = download_lock()
        .lock()
        .map_err(|_| "Another model download is already in progress".to_string())?;

    let entry = find_by_id(&model_id).ok_or_else(|| format!("Unknown model id: {model_id}"))?;
    if is_installed(entry.id) {
        return model_status(entry.id);
    }

    let dest = model_file_path(entry.id)?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create models directory: {error}"))?;
    }

    let temp_path = dest.with_extension(format!("{MODEL_FILE_EXTENSION}.part"));

    emit_progress(
        &app,
        ModelDownloadProgress {
            model_id: entry.id.to_string(),
            downloaded_bytes: 0,
            total_bytes: Some(entry.size_bytes),
            phase: "downloading".to_string(),
            message: Some(format!("Downloading {} → {}", entry.from_name, entry.to_name)),
        },
    );

    let client = http_client()?;
    let mut response = client
        .get(entry.download_url)
        .send()
        .map_err(|error| format!("Download failed: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        return Err(format!("Download HTTP {status} for {}", entry.download_url));
    }

    let total_bytes = response.content_length().or(Some(entry.size_bytes));
    let mut file = File::create(&temp_path)
        .map_err(|error| format!("Failed to create temp file: {error}"))?;

    let mut buffer = [0u8; 64 * 1024];
    let mut downloaded_bytes = 0u64;
    let mut last_emit = 0u64;

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|error| format!("Download read failed: {error}"))?;
        if read == 0 {
            break;
        }

        file.write_all(&buffer[..read])
            .map_err(|error| format!("Failed to write model file: {error}"))?;
        downloaded_bytes += read as u64;

        if downloaded_bytes - last_emit >= 512 * 1024 || downloaded_bytes == total_bytes.unwrap_or(0) {
            emit_progress(
                &app,
                ModelDownloadProgress {
                    model_id: entry.id.to_string(),
                    downloaded_bytes,
                    total_bytes,
                    phase: "downloading".to_string(),
                    message: None,
                },
            );
            last_emit = downloaded_bytes;
        }
    }

    file.sync_all()
        .map_err(|error| format!("Failed to flush model file: {error}"))?;
    drop(file);

    fs::rename(&temp_path, &dest).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        format!("Failed to finalize model file: {error}")
    })?;

    emit_progress(
        &app,
        ModelDownloadProgress {
            model_id: entry.id.to_string(),
            downloaded_bytes,
            total_bytes,
            phase: "complete".to_string(),
            message: Some(format!(
                "Installed {} → {} model",
                entry.from_name, entry.to_name
            )),
        },
    );

    model_status(entry.id)
}

pub fn delete_model(model_id: String) -> Result<(), String> {
    let entry = find_by_id(&model_id).ok_or_else(|| format!("Unknown model id: {model_id}"))?;
    let path = model_file_path(entry.id)?;

    if path.exists() {
        fs::remove_file(&path).map_err(|error| format!("Failed to delete model: {error}"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{catalog_item, model_file_path, models_root};
    use crate::models::catalog;

    #[test]
    fn models_root_is_under_selectmind() {
        let root = models_root().expect("models root");
        let path = root.to_string_lossy();
        assert!(path.contains("SelectMind"));
        assert!(path.ends_with("models"));
    }

    #[test]
    fn model_file_uses_argos_extension() {
        let path = model_file_path("translate-en_ru").expect("path");
        assert!(path.to_string_lossy().ends_with("translate-en_ru.argosmodel"));
    }

    #[test]
    fn catalog_item_marks_not_installed_by_default() {
        let entry = catalog::find_by_id("translate-en_ru").expect("entry");
        let item = catalog_item(entry);
        assert_eq!(item.id, "translate-en_ru");
        assert!(!item.installed || item.installed_size_bytes.is_some());
    }
}
