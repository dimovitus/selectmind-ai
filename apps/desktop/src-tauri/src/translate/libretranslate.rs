use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE, USER_AGENT};
use std::time::Duration;

const USER_AGENT_VALUE: &str = "SelectMind-Desktop/0.2";
const DEFAULT_BASE_URL: &str = "http://127.0.0.1:5000";

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(8))
        .default_headers(default_headers())
        .build()
        .map_err(|error| error.to_string())
}

fn default_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers
}

pub fn normalize_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        DEFAULT_BASE_URL.to_string()
    } else {
        trimmed.to_string()
    }
}

fn resolve_source(source_language: Option<&str>) -> String {
    match source_language {
        Some(code) if !code.is_empty() => code.to_string(),
        _ => "auto".to_string(),
    }
}

pub fn ping(base_url: &str) -> Result<String, String> {
    let base = normalize_base_url(base_url);
    let http = client()?;
    let response = http
        .get(format!("{base}/languages"))
        .send()
        .map_err(|error| format!("LibreTranslate unreachable at {base}: {error}"))?;

    let status = response.status();
    let body = response.text().map_err(|error| error.to_string())?;

    if !status.is_success() {
        return Err(format!("LibreTranslate HTTP {status}: {body}"));
    }

    let languages: Vec<serde_json::Value> =
        serde_json::from_str(&body).map_err(|error| format!("Invalid LibreTranslate JSON: {error}"))?;

    Ok(format!(
        "LibreTranslate reachable at {base} ({} languages)",
        languages.len()
    ))
}

pub fn translate_batch(
    base_url: &str,
    texts: &[String],
    target_language: &str,
    source_language: Option<&str>,
) -> Result<super::engines::EngineResult, String> {
    if texts.is_empty() {
        return Ok(super::engines::EngineResult {
            translations: Vec::new(),
            engine_used: "local-libretranslate".to_string(),
        });
    }

    let base = normalize_base_url(base_url);
    let http = client()?;
    let source = resolve_source(source_language);
    let mut output = Vec::with_capacity(texts.len());

    for (index, text) in texts.iter().enumerate() {
        if index > 0 {
            std::thread::sleep(Duration::from_millis(40));
        }

        let payload = serde_json::json!({
            "q": text,
            "source": source,
            "target": target_language,
            "format": "text",
        });

        let response = http
            .post(format!("{base}/translate"))
            .json(&payload)
            .send()
            .map_err(|error| format!("LibreTranslate request failed at {base}: {error}"))?;

        let status = response.status();
        let body = response.text().map_err(|error| error.to_string())?;

        if !status.is_success() {
            return Err(format!("LibreTranslate HTTP {status}: {body}"));
        }

        output.push(parse_response(&body)?);
    }

    Ok(super::engines::EngineResult {
        translations: output,
        engine_used: "local-libretranslate".to_string(),
    })
}

fn parse_response(body: &str) -> Result<String, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|error| format!("Invalid LibreTranslate JSON: {error}"))?;

    json.get("translatedText")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "LibreTranslate response missing translatedText".to_string())
}

#[cfg(test)]
mod tests {
    use super::{normalize_base_url, parse_response};

    #[test]
    fn normalizes_base_url() {
        assert_eq!(
            normalize_base_url("http://127.0.0.1:5000/"),
            "http://127.0.0.1:5000"
        );
        assert_eq!(normalize_base_url(""), "http://127.0.0.1:5000");
    }

    #[test]
    fn parses_translate_response() {
        let body = r#"{"translatedText":"Привет"}"#;
        assert_eq!(parse_response(body).unwrap(), "Привет");
    }
}
