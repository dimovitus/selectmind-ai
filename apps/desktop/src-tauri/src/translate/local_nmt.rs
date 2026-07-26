use crate::argos_sidecar;
use crate::models;

pub fn translate_batch(
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

    let source = source_language
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("en");
    let target = target_language.trim();

    if !models::is_pair_installed(source, target) {
        let pair = format!("{source}→{target}");
        return Err(format!(
            "Offline model {pair} is not installed. Download it in Settings → Live game translate → Offline models."
        ));
    }

    let base_url = argos_sidecar::ensure_running()?;
    super::argos::translate_batch(
        &base_url,
        texts,
        target,
        source_language,
        engine_used,
    )
}
