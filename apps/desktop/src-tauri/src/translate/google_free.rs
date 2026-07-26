use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use std::time::Duration;

const USER_AGENT_VALUE: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ENDPOINT: &str = "https://translate.googleapis.com/translate_a/single";

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

pub fn translate_batch(
    texts: &[String],
    target_language: &str,
    source_language: Option<&str>,
) -> Result<Vec<String>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    let http = client()?;
    let sl = source_language.unwrap_or("auto");
    let mut last_error = String::from("Google Translate request failed");

    for attempt in 0..3 {
        if attempt > 0 {
            std::thread::sleep(Duration::from_millis(400 * (attempt as u64)));
        }

        let mut query: Vec<(&str, &str)> = vec![
            ("client", "gtx"),
            ("sl", sl),
            ("tl", target_language),
            ("dt", "t"),
        ];

        for text in texts {
            query.push(("q", text.as_str()));
        }

        let response = http
            .get(ENDPOINT)
            .query(&query)
            .send()
            .map_err(|error| error.to_string())?;

        let status = response.status();
        let body = response.text().map_err(|error| error.to_string())?;

        if status.as_u16() == 429 || status.as_u16() == 403 {
            last_error = format!("Google Translate rate limited ({status})");
            continue;
        }

        if !status.is_success() {
            last_error = format!("Google Translate HTTP {status}: {body}");
            continue;
        }

        return parse_response(&body, texts.len());
    }

    Err(last_error)
}

fn parse_response(body: &str, expected: usize) -> Result<Vec<String>, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|error| format!("Invalid Google JSON: {error}"))?;

    let segments = json
        .get(0)
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Google Translate response missing segments".to_string())?;

    let mut translations = Vec::with_capacity(expected);
    for segment in segments {
        let translated = segment
            .get(0)
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        translations.push(translated);
    }

    if translations.len() != expected {
        return Err(format!(
            "Google Translate returned {} items, expected {expected}",
            translations.len()
        ));
    }

    Ok(translations)
}

#[cfg(test)]
mod tests {
    use super::parse_response;

    #[test]
    fn parses_single_segment_response() {
        let body = r#"[[["Привет","Hello",null,null,10]],null,"en"]"#;
        let parsed = parse_response(body, 1).unwrap();
        assert_eq!(parsed, vec!["Привет".to_string()]);
    }
}
