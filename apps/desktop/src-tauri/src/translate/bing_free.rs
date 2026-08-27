use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, REFERER, USER_AGENT};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const USER_AGENT_VALUE: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
const TRANSLATOR_PATH: &str = "/translator";
const MAX_TEXT_LEN: usize = 1000;

struct BingTokens {
    ig: String,
    iid: String,
    subdomain: String,
    key: u64,
    token: String,
    fetched_at: Instant,
    expiry_ms: u64,
}

struct BingSession {
    client: Client,
    tokens: Option<BingTokens>,
}

static SESSION: OnceLock<Mutex<BingSession>> = OnceLock::new();

fn session() -> Result<&'static Mutex<BingSession>, String> {
    SESSION.get_or_init(|| {
        Mutex::new(BingSession {
            client: build_client().expect("bing translate client"),
            tokens: None,
        })
    });
    Ok(SESSION.get().expect("bing session initialized"))
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(12))
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::limited(5))
        .default_headers(default_headers())
        .build()
        .map_err(|error| error.to_string())
}

fn default_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    headers
}

fn bing_origin(subdomain: &str) -> String {
    if subdomain.is_empty() {
        "https://bing.com".to_string()
    } else {
        format!("https://{subdomain}.bing.com")
    }
}

fn subdomain_from_url(url: &str) -> String {
    let Some(host) = url.split("//").nth(1).and_then(|rest| rest.split('/').next()) else {
        return "www".to_string();
    };

    if host == "bing.com" {
        return String::new();
    }

    host.strip_suffix(".bing.com")
        .unwrap_or("www")
        .to_string()
}

fn extract_quoted_after(body: &str, marker: &str) -> Result<String, String> {
    let start = body
        .find(marker)
        .ok_or_else(|| format!("Bing page missing `{marker}`"))?
        + marker.len();
    let rest = &body[start..];
    let end = rest
        .find('"')
        .ok_or_else(|| format!("Bing page malformed after `{marker}`"))?;
    Ok(rest[..end].to_string())
}

fn parse_abuse_prevention_helper(body: &str) -> Result<(u64, String, u64), String> {
    let marker = "params_AbusePreventionHelper = ";
    let start = body
        .find(marker)
        .ok_or_else(|| "Bing page missing abuse prevention helper".to_string())?
        + marker.len();
    let rest = &body[start..];
    let end = rest
        .find(']')
        .ok_or_else(|| "Bing page malformed abuse prevention helper".to_string())?
        + 1;
    let values: Vec<serde_json::Value> =
        serde_json::from_str(&rest[..end]).map_err(|error| error.to_string())?;

    let key = values
        .first()
        .and_then(|value| value.as_u64())
        .ok_or_else(|| "Bing page missing translation key".to_string())?;
    let token = values
        .get(1)
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Bing page missing translation token".to_string())?
        .to_string();
    let expiry_ms = values.get(2).and_then(|value| value.as_u64()).unwrap_or(360_000);

    Ok((key, token, expiry_ms))
}

fn fetch_tokens(client: &Client, subdomain_hint: Option<&str>) -> Result<BingTokens, String> {
    let initial_origin = subdomain_hint
        .filter(|value| !value.is_empty())
        .map(|value| bing_origin(value))
        .unwrap_or_else(|| bing_origin("www"));
    let url = format!("{initial_origin}{TRANSLATOR_PATH}");

    let response = client
        .get(&url)
        .send()
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let page_url = response.url().to_string();
    let body = response.text().map_err(|error| error.to_string())?;

    if !status.is_success() {
        return Err(format!("Bing translator page HTTP {status}"));
    }

    if body.contains("ShowCaptcha") {
        return Err("Bing Translator is asking for captcha — try again later".to_string());
    }

    let ig = extract_quoted_after(&body, "IG:\"")?;
    let iid = extract_quoted_after(&body, "data-iid=\"")?;
    let (key, token, expiry_ms) = parse_abuse_prevention_helper(&body)?;
    let subdomain = subdomain_from_url(&page_url);

    Ok(BingTokens {
        ig,
        iid,
        subdomain,
        key,
        token,
        fetched_at: Instant::now(),
        expiry_ms,
    })
}

fn tokens_expired(tokens: &BingTokens) -> bool {
    tokens.fetched_at.elapsed() > Duration::from_millis(tokens.expiry_ms)
}

fn ensure_tokens(session: &mut BingSession) -> Result<BingTokens, String> {
    if let Some(tokens) = session.tokens.as_ref() {
        if !tokens_expired(tokens) {
            return Ok(tokens.clone());
        }
    }

    let subdomain = session
        .tokens
        .as_ref()
        .map(|tokens| tokens.subdomain.clone());
    let tokens = fetch_tokens(&session.client, subdomain.as_deref())?;
    session.tokens = Some(tokens.clone());
    Ok(tokens)
}

impl Clone for BingTokens {
    fn clone(&self) -> Self {
        Self {
            ig: self.ig.clone(),
            iid: self.iid.clone(),
            subdomain: self.subdomain.clone(),
            key: self.key,
            token: self.token.clone(),
            fetched_at: self.fetched_at,
            expiry_ms: self.expiry_ms,
        }
    }
}

pub fn resolve_bing_language(code: &str) -> String {
    match code.to_lowercase().as_str() {
        "auto" => "auto-detect".to_string(),
        "zh" | "zh-cn" => "zh-Hans".to_string(),
        "zh-tw" => "zh-Hant".to_string(),
        other => other.to_string(),
    }
}

fn translate_one(
    client: &Client,
    tokens: &BingTokens,
    text: &str,
    target_language: &str,
    source_language: Option<&str>,
) -> Result<String, String> {
    if text.len() <= MAX_TEXT_LEN {
        return translate_one_chunk(client, tokens, text, target_language, source_language);
    }

    let mut output = String::new();
    for chunk in split_text_for_translation(text, MAX_TEXT_LEN - 50) {
        let translated =
            translate_one_chunk(client, tokens, &chunk, target_language, source_language)?;
        if !output.is_empty() && !translated.is_empty() {
            if !output.ends_with(' ') && !translated.starts_with(' ') {
                output.push(' ');
            }
        }
        output.push_str(&translated);
    }
    Ok(output.trim().to_string())
}

fn split_text_for_translation(text: &str, max_len: usize) -> Vec<String> {
    if text.len() <= max_len {
        return vec![text.to_string()];
    }

    let mut chunks = Vec::new();
    let mut rest = text.trim();
    while !rest.is_empty() {
        if rest.len() <= max_len {
            chunks.push(rest.to_string());
            break;
        }

        let mut split_at = rest[..max_len].rfind(['.', '!', '?', '\n']).unwrap_or(max_len);
        if split_at < max_len / 3 {
            split_at = rest[..max_len].rfind(' ').unwrap_or(max_len);
        }
        if split_at == 0 {
            split_at = max_len;
        }

        let (chunk, next) = rest.split_at(split_at);
        chunks.push(chunk.trim().to_string());
        rest = next.trim_start();
    }

    chunks
}

fn translate_one_chunk(
    client: &Client,
    tokens: &BingTokens,
    text: &str,
    target_language: &str,
    source_language: Option<&str>,
) -> Result<String, String> {
    if text.is_empty() {
        return Ok(String::new());
    }
    if text.len() > MAX_TEXT_LEN {
        return Err(format!(
            "Bing Translate supports at most {MAX_TEXT_LEN} characters per request"
        ));
    }

    let from_lang = source_language
        .map(resolve_bing_language)
        .unwrap_or_else(|| "auto-detect".to_string());
    let to_lang = resolve_bing_language(target_language);
    let origin = bing_origin(&tokens.subdomain);
    let url = format!(
        "{origin}/ttranslatev3?isVertical=1&&IG={}&IID={}",
        tokens.ig, tokens.iid
    );

    let response = client
        .post(&url)
        .header(REFERER, format!("{origin}{TRANSLATOR_PATH}"))
        .form(&[
            ("fromLang", from_lang.as_str()),
            ("to", to_lang.as_str()),
            ("text", text),
            ("token", tokens.token.as_str()),
            ("key", &tokens.key.to_string()),
            ("tryFetchingGenderDebiasedTranslations", "false"),
        ])
        .send()
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = response.text().map_err(|error| error.to_string())?;

    if status.as_u16() == 401 {
        return Err("Bing Translate rate limit exceeded".to_string());
    }

    if !status.is_success() {
        return Err(format!("Bing Translate HTTP {status}: {body}"));
    }

    parse_response(&body)
}

pub fn translate_batch(
    texts: &[String],
    target_language: &str,
    source_language: Option<&str>,
) -> Result<Vec<String>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    let session_lock = session()?;
    let mut session = session_lock
        .lock()
        .map_err(|_| "bing translate session poisoned".to_string())?;

    let mut output = Vec::with_capacity(texts.len());
    for (index, text) in texts.iter().enumerate() {
        if index > 0 {
            std::thread::sleep(Duration::from_millis(120));
        }

        let mut translation = None;
        for attempt in 0..2 {
            if attempt > 0 {
                session.tokens = None;
            }

            let tokens = ensure_tokens(&mut session)?;
            match translate_one(
                &session.client,
                &tokens,
                text,
                target_language,
                source_language,
            ) {
                Ok(value) => {
                    translation = Some(value);
                    break;
                }
                Err(error) if attempt + 1 >= 2 => return Err(error),
                Err(_) => {}
            }
        }

        output.push(
            translation.ok_or_else(|| "Bing Translate request failed".to_string())?,
        );
    }

    Ok(output)
}

fn parse_response(body: &str) -> Result<String, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|error| format!("Invalid Bing JSON: {error}"))?;

    let translation = json
        .get(0)
        .and_then(|segment| segment.get("translations"))
        .and_then(|translations| translations.get(0))
        .and_then(|translation| translation.get("text"))
        .and_then(|text| text.as_str())
        .ok_or_else(|| "Bing Translate response missing translation".to_string())?
        .trim()
        .to_string();

    Ok(translation)
}

#[cfg(test)]
mod tests {
    use super::{parse_response, resolve_bing_language};

    #[test]
    fn parses_bing_response() {
        let body = r#"[{"detectedLanguage":{"language":"en","score":1.0},"translations":[{"text":"Привет","to":"ru"}]}]"#;
        assert_eq!(parse_response(body).unwrap(), "Привет");
    }

    #[test]
    fn maps_language_codes() {
        assert_eq!(resolve_bing_language("auto"), "auto-detect");
        assert_eq!(resolve_bing_language("zh"), "zh-Hans");
        assert_eq!(resolve_bing_language("ru"), "ru");
    }
}
