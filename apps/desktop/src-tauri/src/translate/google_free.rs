use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, USER_AGENT};
use reqwest::Client;
use std::sync::OnceLock;
use std::time::Duration;

const USER_AGENT_VALUE: &str = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const MOBILE_ENDPOINT: &str = "https://translate.google.com/m";

/// Google leaves this token untouched while translating, so a single request can
/// carry a whole screen of UI strings instead of one round trip per line.
const BATCH_SEPARATOR: &str = " @@@ ";
const BATCH_SPLIT_TOKEN: &str = "@@@";
/// Long requests start losing the 1:1 mapping (Google inserts its own
/// separators), so keep batches well inside the range that round-trips cleanly.
const MAX_BATCH_ITEMS: usize = 25;
const MAX_BATCH_CHARS: usize = 1200;

static HTTP: OnceLock<Client> = OnceLock::new();

fn shared_client() -> Result<&'static Client, String> {
    if let Some(client) = HTTP.get() {
        return Ok(client);
    }
    let client = Client::builder()
        .timeout(Duration::from_secs(4))
        .pool_max_idle_per_host(4)
        .default_headers(default_headers())
        .build()
        .map_err(|error| error.to_string())?;
    let _ = HTTP.set(client);
    HTTP.get()
        .ok_or_else(|| "Google HTTP client failed to initialize".to_string())
}

fn default_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("text/html,application/xhtml+xml"),
    );
    headers
}

pub async fn translate_batch(
    texts: &[String],
    target_language: &str,
    source_language: Option<&str>,
) -> Result<Vec<String>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    // Mobile HTML page — gtx JSON is captcha-blocked on many networks.
    translate_via_mobile(texts, target_language, source_language).await
}

/// Group line indices into requests bounded by item count and query length.
fn build_batches(texts: &[String]) -> Vec<Vec<usize>> {
    let mut batches: Vec<Vec<usize>> = Vec::new();
    let mut current: Vec<usize> = Vec::new();
    let mut current_chars = 0usize;

    for (index, text) in texts.iter().enumerate() {
        if text.contains(BATCH_SPLIT_TOKEN) {
            if !current.is_empty() {
                batches.push(std::mem::take(&mut current));
                current_chars = 0;
            }
            batches.push(vec![index]);
            continue;
        }

        let projected = current_chars + text.chars().count() + BATCH_SEPARATOR.len();
        if !current.is_empty() && (current.len() >= MAX_BATCH_ITEMS || projected > MAX_BATCH_CHARS)
        {
            batches.push(std::mem::take(&mut current));
            current_chars = 0;
        }

        current_chars += text.chars().count() + BATCH_SEPARATOR.len();
        current.push(index);
    }

    if !current.is_empty() {
        batches.push(current);
    }

    batches
}

fn split_batch_response(translated: &str, expected: usize) -> Option<Vec<String>> {
    let parts: Vec<String> = translated
        .split(BATCH_SPLIT_TOKEN)
        .map(|part| part.trim().to_string())
        .collect();

    if parts.len() != expected || parts.iter().any(String::is_empty) {
        return None;
    }
    Some(parts)
}

async fn translate_via_mobile(
    texts: &[String],
    target_language: &str,
    source_language: Option<&str>,
) -> Result<Vec<String>, String> {
    let http = shared_client()?;
    let sl = source_language.unwrap_or("auto");
    let mut output = texts.to_vec();
    let mut ok = 0usize;
    let mut requests = 0usize;
    let mut last_error = String::from("Google mobile translate failed");

    for batch in build_batches(texts) {
        if requests > 0 {
            tokio::time::sleep(Duration::from_millis(80)).await;
        }
        requests += 1;

        if batch.len() > 1 {
            let joined = batch
                .iter()
                .map(|index| texts[*index].as_str())
                .collect::<Vec<_>>()
                .join(BATCH_SEPARATOR);

            match translate_one_mobile(http, &joined, target_language, sl).await {
                Ok(translated) => {
                    if let Some(parts) = split_batch_response(&translated, batch.len()) {
                        for (slot, part) in batch.iter().zip(parts) {
                            output[*slot] = part;
                        }
                        ok += batch.len();
                        continue;
                    }
                }
                Err(error) => last_error = error,
            }
        }

        for index in batch {
            match translate_one_mobile(http, &texts[index], target_language, sl).await {
                Ok(translated) => {
                    output[index] = translated;
                    ok += 1;
                }
                Err(error) => last_error = error,
            }
            tokio::time::sleep(Duration::from_millis(60)).await;
        }
    }

    if ok == 0 {
        return Err(last_error);
    }

    eprintln!(
        "[selectmind] google mobile translated {ok}/{} lines in {requests} request(s)",
        texts.len()
    );
    Ok(output)
}

async fn translate_one_mobile(
    http: &Client,
    text: &str,
    target_language: &str,
    source_language: &str,
) -> Result<String, String> {
    let response = http
        .get(MOBILE_ENDPOINT)
        .query(&[
            ("sl", source_language),
            ("tl", target_language),
            ("q", text),
        ])
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;

    if body.contains("unusual traffic") || body.contains("<title>Sorry") {
        return Err("Google Translate captcha / unusual traffic".to_string());
    }

    if !status.is_success() {
        return Err(format!("Google mobile HTTP {status}"));
    }

    parse_mobile_html(&body)
}

fn parse_mobile_html(body: &str) -> Result<String, String> {
    const MARKER: &str = "result-container";
    let mut search_from = 0usize;
    let mut last_error = String::from("Google mobile response missing result-container");

    while let Some(rel) = body[search_from..].find(MARKER) {
        let start = search_from + rel;
        let after = &body[start + MARKER.len()..];
        let Some(gt) = after.find('>') else {
            last_error = "Google mobile result-container malformed".to_string();
            search_from = start + MARKER.len();
            continue;
        };
        let content = &after[gt + 1..];
        let Some(end) = content.find('<') else {
            last_error = "Google mobile result-container unclosed".to_string();
            search_from = start + MARKER.len();
            continue;
        };
        let text = html_unescape(content[..end].trim());
        if !text.is_empty() {
            return Ok(text);
        }
        last_error = "Google mobile returned empty translation".to_string();
        search_from = start + MARKER.len();
    }

    Err(last_error)
}

fn html_unescape(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

#[cfg(test)]
mod tests {
    use super::{
        build_batches, parse_mobile_html, split_batch_response, translate_batch, MAX_BATCH_ITEMS,
    };

    fn texts(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn packs_short_lines_into_one_request() {
        let batches = build_batches(&texts(&["START", "SETTINGS", "QUIT"]));
        assert_eq!(batches, vec![vec![0, 1, 2]]);
    }

    #[test]
    fn caps_batches_by_item_count() {
        let lines: Vec<String> = (0..MAX_BATCH_ITEMS + 3)
            .map(|i| format!("Line {i}"))
            .collect();
        let batches = build_batches(&lines);
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].len(), MAX_BATCH_ITEMS);
        assert_eq!(batches[1].len(), 3);
    }

    #[test]
    fn caps_batches_by_length() {
        let long = "x".repeat(700);
        let batches = build_batches(&texts(&[&long, &long, &long]));
        assert_eq!(batches.len(), 3);
    }

    #[test]
    fn isolates_lines_containing_the_separator() {
        let batches = build_batches(&texts(&["safe", "war @@@ peace", "also safe"]));
        assert_eq!(batches, vec![vec![0], vec![1], vec![2]]);
    }

    #[test]
    fn splits_a_batch_response_back_into_lines() {
        let parts = split_batch_response("НАЧАТЬ @@@ НАСТРОЙКИ @@@ ВЫХОД", 3).unwrap();
        assert_eq!(parts, texts(&["НАЧАТЬ", "НАСТРОЙКИ", "ВЫХОД"]));
    }

    #[test]
    fn rejects_a_batch_response_that_lost_its_mapping() {
        assert!(split_batch_response("НАЧАТЬ @@@ НАСТРОЙКИ", 3).is_none());
        assert!(split_batch_response("НАЧАТЬ @@@  @@@ ВЫХОД", 3).is_none());
    }

    #[test]
    fn parses_mobile_result_container() {
        let html = r#"<html><div class="result-container">НАЧИНАТЬ</div></html>"#;
        assert_eq!(parse_mobile_html(html).unwrap(), "НАЧИНАТЬ");
    }

    #[test]
    fn skips_empty_result_container() {
        let html =
            r#"<div class="result-container"></div><div class="result-container">НАЧИНАТЬ</div>"#;
        assert_eq!(parse_mobile_html(html).unwrap(), "НАЧИНАТЬ");
    }

    #[test]
    #[ignore = "hits translate.google.com"]
    fn live_batch_translates_via_mobile() {
        let texts = vec![
            "START".to_string(),
            "SETTINGS".to_string(),
            "QUIT".to_string(),
        ];
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let out = runtime
            .block_on(translate_batch(&texts, "ru", Some("en")))
            .expect("mobile translate");
        assert_eq!(out.len(), 3);
        assert_ne!(out[0], "START");
        assert!(out[0]
            .chars()
            .any(|c| ('\u{0400}'..='\u{04FF}').contains(&c)));
    }
}
