use crate::models;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const USER_AGENT_VALUE: &str = "SelectMind-Desktop/0.2";
const DEFAULT_PORT: u16 = 18_765;
const DEFAULT_HOST: &str = "127.0.0.1";
const SIDECAR_BINARY_NAME: &str = if cfg!(windows) {
    "selectmind-argos.exe"
} else {
    "selectmind-argos"
};

struct SidecarRuntime {
    child: Child,
    base_url: String,
}

static RUNTIME: OnceLock<Mutex<Option<SidecarRuntime>>> = OnceLock::new();

fn runtime() -> &'static Mutex<Option<SidecarRuntime>> {
    RUNTIME.get_or_init(|| Mutex::new(None))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArgosSidecarStatus {
    pub running: bool,
    pub base_url: String,
    pub available: bool,
    pub message: String,
    pub language_pairs: Vec<LanguagePair>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguagePair {
    pub source: String,
    pub target: String,
}

pub fn default_base_url() -> String {
    format!("http://{DEFAULT_HOST}:{DEFAULT_PORT}")
}

pub fn sidecar_status() -> Result<ArgosSidecarStatus, String> {
    let base_url = default_base_url();
    match health(&base_url) {
        Ok(pairs) => Ok(ArgosSidecarStatus {
            running: true,
            base_url: base_url.clone(),
            available: true,
            message: format!("Argos sidecar reachable ({pairs} language pairs)"),
            language_pairs: list_language_pairs(&base_url).unwrap_or_default(),
        }),
        Err(error) => Ok(ArgosSidecarStatus {
            running: false,
            base_url,
            available: command_available().is_ok(),
            message: error,
            language_pairs: Vec::new(),
        }),
    }
}

pub fn ping() -> Result<String, String> {
    let base_url = ensure_running()?;
    let pairs = health(&base_url)?;
    Ok(format!("Argos sidecar reachable at {base_url} ({pairs} language pairs)"))
}

pub fn ensure_running() -> Result<String, String> {
    if let Ok(base_url) = try_existing_runtime() {
        return Ok(base_url);
    }

    let base_url = default_base_url();
    if health(&base_url).is_ok() {
        return Ok(base_url);
    }

    spawn_sidecar()?;
    wait_until_ready(&base_url)?;
    Ok(base_url)
}

fn try_existing_runtime() -> Result<String, String> {
    let mut guard = runtime()
        .lock()
        .map_err(|_| "Argos sidecar state lock poisoned".to_string())?;

    if let Some(runtime) = guard.as_mut() {
        match runtime.child.try_wait() {
            Ok(Some(_status)) => {
                *guard = None;
            }
            Ok(None) => {
                if health(&runtime.base_url).is_ok() {
                    return Ok(runtime.base_url.clone());
                }
                let _ = runtime.child.kill();
                *guard = None;
            }
            Err(error) => {
                return Err(format!("Failed to inspect Argos sidecar process: {error}"));
            }
        }
    }

    Err("Argos sidecar is not running".to_string())
}

fn spawn_sidecar() -> Result<(), String> {
    let mut guard = runtime()
        .lock()
        .map_err(|_| "Argos sidecar state lock poisoned".to_string())?;

    if guard.is_some() {
        return Ok(());
    }

    let models_dir = models::models_root()?;
    models::ensure_models_dir()?;
    let (program, args) = resolve_sidecar_command()?;

    let mut command = Command::new(&program);
    command
        .args(&args)
        .env("SELECTMIND_MODELS_DIR", models_dir)
        .env("SELECTMIND_ARGOS_PORT", DEFAULT_PORT.to_string())
        .env("SELECTMIND_ARGOS_HOST", DEFAULT_HOST)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start Argos sidecar ({program}): {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Argos sidecar did not expose stdout".to_string())?;

    let base_url = read_ready_line(stdout)?;
    *guard = Some(SidecarRuntime { child, base_url });
    Ok(())
}

fn read_ready_line(stdout: impl Into<std::process::ChildStdout>) -> Result<String, String> {
    let mut reader = BufReader::new(stdout.into());
    let mut line = String::new();
    let deadline = Instant::now() + Duration::from_secs(120);

    while Instant::now() < deadline {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if let Some(url) = trimmed.strip_prefix("READY:") {
                    return Ok(url.to_string());
                }
            }
            Err(error) => {
                return Err(format!("Failed to read Argos sidecar startup output: {error}"));
            }
        }
    }

    Err("Argos sidecar did not become ready in time".to_string())
}

fn wait_until_ready(base_url: &str) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(120);
    while Instant::now() < deadline {
        if health(base_url).is_ok() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Err("Argos sidecar health check timed out".to_string())
}

fn health(base_url: &str) -> Result<usize, String> {
    let client = http_client()?;
    let response = client
        .get(format!("{base_url}/health"))
        .send()
        .map_err(|error| format!("Argos sidecar unreachable at {base_url}: {error}"))?;

    let status = response.status();
    let body = response.text().map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("Argos sidecar HTTP {status}: {body}"));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|error| format!("Invalid Argos health JSON: {error}"))?;
    let pairs = json
        .get("pairs")
        .and_then(|value| value.as_array())
        .map(|value| value.len())
        .unwrap_or(0);
    Ok(pairs)
}

fn list_language_pairs(base_url: &str) -> Result<Vec<LanguagePair>, String> {
    let client = http_client()?;
    let response = client
        .get(format!("{base_url}/health"))
        .send()
        .map_err(|error| error.to_string())?;
    let body = response.text().map_err(|error| error.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;

    let pairs = json
        .get("pairs")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(pairs
        .into_iter()
        .filter_map(|value| {
            Some(LanguagePair {
                source: value.get("source")?.as_str()?.to_string(),
                target: value.get("target")?.as_str()?.to_string(),
            })
        })
        .collect())
}

fn http_client() -> Result<Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));

    Client::builder()
        .timeout(Duration::from_secs(5))
        .default_headers(headers)
        .build()
        .map_err(|error| error.to_string())
}

fn resolve_sidecar_command() -> Result<(String, Vec<String>), String> {
    if let Some(bundled) = bundled_sidecar_path() {
        return Ok((bundled.to_string_lossy().to_string(), Vec::new()));
    }

    let script = dev_sidecar_script_path();
    if !script.is_file() {
        return Err(format!(
            "Argos sidecar script not found at {}",
            script.display()
        ));
    }

    for candidate in python_candidates() {
        if command_exists(candidate) {
            return Ok((
                candidate.to_string(),
                vec![script.to_string_lossy().to_string()],
            ));
        }
    }

    Err(
        "Argos sidecar is unavailable. Install Python 3 + argostranslate for development, or bundle the selectmind-argos sidecar."
            .to_string(),
    )
}

fn command_available() -> Result<(), String> {
    resolve_sidecar_command().map(|_| ())
}

fn bundled_sidecar_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let candidate = exe.parent()?.join(SIDECAR_BINARY_NAME);
    if candidate.is_file() {
        Some(candidate)
    } else {
        None
    }
}

fn dev_sidecar_script_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../sidecar/argos_server.py")
}

fn python_candidates() -> [&'static str; 3] {
    if cfg!(windows) {
        ["py", "python", "python3"]
    } else {
        ["python3", "python", "py"]
    }
}

fn command_exists(program: &str) -> bool {
    let mut command = if cfg!(windows) && program == "py" {
        let mut cmd = Command::new(program);
        cmd.arg("-3");
        cmd
    } else {
        Command::new(program)
    };

    command
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub fn shutdown() {
    if let Ok(mut guard) = runtime().lock() {
        if let Some(mut runtime) = guard.take() {
            let _ = runtime.child.kill();
            let _ = runtime.child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{default_base_url, dev_sidecar_script_path};

    #[test]
    fn default_base_url_uses_local_port() {
        assert!(default_base_url().contains("127.0.0.1:18765"));
    }

    #[test]
    fn dev_sidecar_script_path_exists_in_repo() {
        let path = dev_sidecar_script_path();
        assert!(path.ends_with("sidecar/argos_server.py") || path.ends_with("sidecar\\argos_server.py"));
    }
}
