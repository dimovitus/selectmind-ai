use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use std::time::Duration;

const USER_AGENT_VALUE: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(12))
        .default_headers(default_headers())
        .build()
        .map_err(|error| error.to_string())
}

fn default_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(USER_AGENT_VALUE),
    );
    headers
}

fn normalize_base_url(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

pub fn translate_batch(
    base_url: &str,
    texts: &[String],
    target_language: &str,
    source_language: Option<&str>,
) -> Result<Vec<String>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    let base = normalize_base_url(base_url);
    if base.is_empty() {
        return Err("Proxy base URL is empty".to_string());
    }

    let http = client()?;
    let source = source_language.unwrap_or("auto");
    let mut output = Vec::with_capacity(texts.len());

    for text in texts {
        let encoded = urlencoding::encode(text);
        let url = format!("{base}/api/v1/{source}/{target_language}/{encoded}");
        let response = http.get(&url).send().map_err(|error| error.to_string())?;
        let status = response.status();
        let body = response.text().map_err(|error| error.to_string())?;

        if !status.is_success() {
            return Err(format!("Lingva proxy HTTP {status}: {body}"));
        }

        let json: serde_json::Value =
            serde_json::from_str(&body).map_err(|error| format!("Invalid Lingva JSON: {error}"))?;
        let translation = json
            .get("translation")
            .and_then(|value| value.as_str())
            .ok_or_else(|| "Lingva response missing translation field".to_string())?
            .trim()
            .to_string();

        output.push(translation);
        std::thread::sleep(Duration::from_millis(120));
    }

    Ok(output)
}
