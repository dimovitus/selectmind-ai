use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE, USER_AGENT};
use std::time::Duration;

const USER_AGENT_VALUE: &str = "SelectMind-Desktop/0.2";

fn client() -> Result<Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    Client::builder()
        .timeout(Duration::from_secs(30))
        .default_headers(headers)
        .build()
        .map_err(|error| error.to_string())
}

pub fn translate_batch(
    base_url: &str,
    texts: &[String],
    target_language: &str,
    source_language: Option<&str>,
    engine_used: &str,
) -> Result<super::engines::EngineResult, String> {
    if texts.is_empty() {
        return Ok(super::engines::EngineResult {
            translations: Vec::new(),
            engine_used: engine_used.to_string(),
        });
    }

    let base = base_url.trim().trim_end_matches('/');
    let source = resolve_source(source_language);
    let http = client()?;

    if texts.len() == 1 {
        let payload = serde_json::json!({
            "q": texts[0],
            "source": source,
            "target": target_language,
        });

        let response = http
            .post(format!("{base}/translate"))
            .json(&payload)
            .send()
            .map_err(|error| format!("Argos sidecar request failed: {error}"))?;

        let status = response.status();
        let body = response.text().map_err(|error| error.to_string())?;
        if !status.is_success() {
            return Err(format!("Argos sidecar HTTP {status}: {body}"));
        }

        return Ok(super::engines::EngineResult {
            translations: vec![parse_single_response(&body)?],
            engine_used: engine_used.to_string(),
        });
    }

    let payload = serde_json::json!({
        "q": texts,
        "source": source,
        "target": target_language,
    });

    let response = http
        .post(format!("{base}/translate"))
        .json(&payload)
        .send()
        .map_err(|error| format!("Argos sidecar request failed: {error}"))?;

    let status = response.status();
    let body = response.text().map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("Argos sidecar HTTP {status}: {body}"));
    }

    Ok(super::engines::EngineResult {
        translations: parse_batch_response(&body, texts.len())?,
        engine_used: engine_used.to_string(),
    })
}

fn resolve_source(source_language: Option<&str>) -> String {
    match source_language {
        Some(code) if !code.is_empty() => code.to_string(),
        _ => "en".to_string(),
    }
}

fn parse_single_response(body: &str) -> Result<String, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|error| format!("Invalid Argos JSON: {error}"))?;

    json.get("translatedText")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "Argos response missing translatedText".to_string())
}

fn parse_batch_response(body: &str, expected: usize) -> Result<Vec<String>, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|error| format!("Invalid Argos JSON: {error}"))?;

    let values = json
        .get("translations")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Argos response missing translations".to_string())?;

    if values.len() != expected {
        return Err(format!(
            "Argos returned {} translations, expected {expected}",
            values.len()
        ));
    }

    values
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::trim)
                .filter(|text| !text.is_empty())
                .map(str::to_string)
                .ok_or_else(|| "Argos batch item was empty".to_string())
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{parse_batch_response, parse_single_response};

    #[test]
    fn parses_single_response() {
        let body = r#"{"translatedText":"Привет"}"#;
        assert_eq!(parse_single_response(body).unwrap(), "Привет");
    }

    #[test]
    fn parses_batch_response() {
        let body = r#"{"translations":["Один","Два"]}"#;
        assert_eq!(
            parse_batch_response(body, 2).unwrap(),
            vec!["Один".to_string(), "Два".to_string()]
        );
    }
}
