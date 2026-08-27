mod argos;
mod bing_free;
mod engines;
mod google_free;
mod lang;
mod libretranslate;
mod lingva;
mod local_nmt;

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

pub use engines::EngineId;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslateBatchArgs {
    pub texts: Vec<String>,
    pub target_language: String,
    pub source_language: Option<String>,
    pub engine: Option<String>,
    pub lingva_base_url: Option<String>,
    pub local_libretranslate_url: Option<String>,
    pub auto_fallback: Option<bool>,
}

impl Default for TranslateBatchArgs {
    fn default() -> Self {
        Self {
            texts: Vec::new(),
            target_language: String::new(),
            source_language: None,
            engine: None,
            lingva_base_url: None,
            local_libretranslate_url: None,
            auto_fallback: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateBatchResult {
    pub translations: Vec<String>,
    pub engine_used: String,
}

struct ThrottleState {
    last_network_request: Option<Instant>,
}

static NETWORK_THROTTLE: OnceLock<Mutex<ThrottleState>> = OnceLock::new();

/// Soft floor between network translate batches. 1200 ms starved continuous
/// live mode (poll ~650 ms) and made on-demand feel stuck behind the throttle.
const NETWORK_MIN_INTERVAL: Duration = Duration::from_millis(350);

fn network_throttle() -> &'static Mutex<ThrottleState> {
    NETWORK_THROTTLE.get_or_init(|| {
        Mutex::new(ThrottleState {
            last_network_request: None,
        })
    })
}

async fn wait_for_network_slot_async() {
    let sleep_for = {
        let mut state = network_throttle()
            .lock()
            .expect("translate network throttle poisoned");
        let wait = state.last_network_request.and_then(|last| {
            let elapsed = last.elapsed();
            (elapsed < NETWORK_MIN_INTERVAL).then_some(NETWORK_MIN_INTERVAL - elapsed)
        });
        state.last_network_request = Some(Instant::now());
        wait
    };
    if let Some(duration) = sleep_for {
        tokio::time::sleep(duration).await;
    }
}

fn fallback_engines(primary: EngineId) -> &'static [EngineId] {
    match primary {
        EngineId::BingFree => &[EngineId::GoogleFree, EngineId::LocalNmt],
        EngineId::LocalLibretranslate => &[EngineId::GoogleFree],
        // Bing is line-by-line and routinely blows the live UI timeout —
        // never auto-chain it after offline failure.
        EngineId::LocalNmt => &[EngineId::GoogleFree],
        // Network scrapers → offline reserve when rate-limited / offline.
        EngineId::GoogleFree | EngineId::GoogleProxy => &[EngineId::LocalNmt],
    }
}

async fn translate_with_optional_fallback(
    primary: EngineId,
    ctx: &engines::TranslateContext<'_>,
    auto_fallback: bool,
) -> Result<engines::EngineResult, String> {
    match engines::translate(primary, ctx).await {
        Ok(result) => Ok(result),
        Err(primary_error) if !auto_fallback => Err(primary_error),
        Err(primary_error) => {
            for fallback in fallback_engines(primary) {
                if fallback.requires_network() {
                    wait_for_network_slot_async().await;
                }
                match engines::translate(*fallback, ctx).await {
                    Ok(result) => {
                        return Ok(engines::EngineResult {
                            translations: result.translations,
                            engine_used: format!("{}→{}", primary.as_str(), result.engine_used),
                        });
                    }
                    Err(_) => continue,
                }
            }
            Err(primary_error)
        }
    }
}

pub async fn translate_batch(args: TranslateBatchArgs) -> Result<TranslateBatchResult, String> {
    if args.texts.is_empty() {
        return Ok(TranslateBatchResult {
            translations: Vec::new(),
            engine_used: "none".to_string(),
        });
    }

    if args.target_language.trim().is_empty() {
        return Err("Target language is not set — check Live translate settings".to_string());
    }

    let engine = EngineId::parse(args.engine.as_deref().unwrap_or("google-free"));
    let auto_fallback = args.auto_fallback.unwrap_or(true);
    let ctx = engines::build_context(&args);

    if engine.requires_network() {
        wait_for_network_slot_async().await;
    }

    let result = translate_with_optional_fallback(engine, &ctx, auto_fallback).await?;
    Ok(TranslateBatchResult {
        translations: result.translations,
        engine_used: result.engine_used,
    })
}

pub fn ping_local_libretranslate(base_url: Option<String>) -> Result<String, String> {
    engines::ping_local_libretranslate(base_url.as_deref())
}

#[cfg(test)]
mod tests {
    use super::{EngineId, fallback_engines, translate_batch, TranslateBatchArgs};

    #[test]
    fn routes_local_engine_without_model_errors_when_no_fallback() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime.block_on(translate_batch(TranslateBatchArgs {
            texts: vec!["Quest accepted".to_string()],
            target_language: "ru".to_string(),
            source_language: Some("auto".to_string()),
            engine: Some("local-nmt".to_string()),
            lingva_base_url: None,
            local_libretranslate_url: None,
            auto_fallback: Some(false),
        }));
        assert!(result.is_err());
    }

    #[test]
    fn empty_batch_returns_none_engine() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime
            .block_on(translate_batch(TranslateBatchArgs {
                texts: vec![],
                target_language: "ru".to_string(),
                source_language: None,
                engine: None,
                lingva_base_url: None,
                local_libretranslate_url: None,
                auto_fallback: None,
            }))
            .unwrap();
        assert_eq!(result.engine_used, "none");
    }

    #[test]
    fn default_engine_is_google_free_id() {
        assert_eq!(EngineId::parse("google-free"), EngineId::GoogleFree);
        assert_eq!(EngineId::parse(""), EngineId::GoogleFree);
    }

    #[test]
    fn bing_has_google_fallback_chain() {
        assert_eq!(
            fallback_engines(EngineId::BingFree),
            &[EngineId::GoogleFree, EngineId::LocalNmt]
        );
        assert_eq!(
            fallback_engines(EngineId::LocalLibretranslate),
            &[EngineId::GoogleFree]
        );
        assert_eq!(
            fallback_engines(EngineId::GoogleFree),
            &[EngineId::LocalNmt]
        );
        assert_eq!(
            fallback_engines(EngineId::GoogleProxy),
            &[EngineId::LocalNmt]
        );
    }

    #[test]
    fn local_nmt_falls_back_to_google_only() {
        assert_eq!(
            fallback_engines(EngineId::LocalNmt),
            &[EngineId::GoogleFree]
        );
    }
}
