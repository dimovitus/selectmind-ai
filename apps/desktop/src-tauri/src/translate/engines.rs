use super::bing_free;
use super::google_free;
use super::lang;
use super::libretranslate;
use super::lingva;
use super::local_nmt;

const DEFAULT_LINGVA_BASE: &str = "https://lingva.ml";
const DEFAULT_LIBRETRANSLATE_BASE: &str = "http://127.0.0.1:5000";

pub struct TranslateContext<'a> {
    pub texts: &'a [String],
    pub target: String,
    pub source: Option<String>,
    pub lingva_base_url: &'a str,
    pub libretranslate_base_url: String,
    pub engine_used_label: String,
}

#[derive(Debug)]
pub struct EngineResult {
    pub translations: Vec<String>,
    pub engine_used: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineId {
    GoogleFree,
    BingFree,
    GoogleProxy,
    LocalLibretranslate,
    LocalNmt,
}

impl EngineId {
    pub fn parse(raw: &str) -> Self {
        match raw {
            "bing-free" => Self::BingFree,
            "google-proxy" => Self::GoogleProxy,
            "local-libretranslate" => Self::LocalLibretranslate,
            "local-nmt" | "local-argos" => Self::LocalNmt,
            _ => Self::GoogleFree,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::GoogleFree => "google-free",
            Self::BingFree => "bing-free",
            Self::GoogleProxy => "google-proxy",
            Self::LocalLibretranslate => "local-libretranslate",
            Self::LocalNmt => "local-nmt",
        }
    }

    pub fn requires_network(self) -> bool {
        !matches!(self, Self::LocalLibretranslate | Self::LocalNmt)
    }
}

pub fn translate(engine: EngineId, ctx: &TranslateContext<'_>) -> Result<EngineResult, String> {
    let source_ref = ctx.source.as_deref();

    match engine {
        EngineId::GoogleProxy => {
            let base = normalize_lingva_base(ctx.lingva_base_url);
            let translations = lingva::translate_batch(base, ctx.texts, &ctx.target, source_ref)?;
            Ok(EngineResult {
                translations,
                engine_used: EngineId::GoogleProxy.as_str().to_string(),
            })
        }
        EngineId::BingFree => {
            let translations = bing_free::translate_batch(ctx.texts, &ctx.target, source_ref)?;
            Ok(EngineResult {
                translations,
                engine_used: EngineId::BingFree.as_str().to_string(),
            })
        }
        EngineId::LocalLibretranslate => libretranslate::translate_batch(
            &ctx.libretranslate_base_url,
            ctx.texts,
            &ctx.target,
            source_ref,
        ),
        EngineId::LocalNmt => local_nmt::translate_batch(
            ctx.texts,
            &ctx.target,
            source_ref,
            &ctx.engine_used_label,
        ),
        EngineId::GoogleFree => translate_google_with_fallback(ctx),
    }
}

fn translate_google_with_fallback(ctx: &TranslateContext<'_>) -> Result<EngineResult, String> {
    let source_ref = ctx.source.as_deref();

    match google_free::translate_batch(ctx.texts, &ctx.target, source_ref) {
        Ok(translations) => Ok(EngineResult {
            translations,
            engine_used: EngineId::GoogleFree.as_str().to_string(),
        }),
        Err(primary_error) => {
            let base = normalize_lingva_base(ctx.lingva_base_url);
            match lingva::translate_batch(base, ctx.texts, &ctx.target, source_ref) {
                Ok(translations) => Ok(EngineResult {
                    translations,
                    engine_used: "google-proxy-fallback".to_string(),
                }),
                Err(proxy_error) => Err(format!(
                    "{primary_error}; proxy fallback failed: {proxy_error}"
                )),
            }
        }
    }
}

fn normalize_lingva_base(base_url: &str) -> &str {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        DEFAULT_LINGVA_BASE
    } else {
        trimmed
    }
}

pub fn build_context(args: &super::TranslateBatchArgs) -> TranslateContext<'_> {
    TranslateContext {
        texts: &args.texts,
        target: lang::resolve_language_code(&args.target_language),
        source: lang::resolve_source_language(args.source_language.as_deref()),
        lingva_base_url: args
            .lingva_base_url
            .as_deref()
            .unwrap_or(DEFAULT_LINGVA_BASE),
        libretranslate_base_url: args
            .local_libretranslate_url
            .as_deref()
            .map(libretranslate::normalize_base_url)
            .unwrap_or_else(|| DEFAULT_LIBRETRANSLATE_BASE.to_string()),
        engine_used_label: args
            .engine
            .clone()
            .unwrap_or_else(|| EngineId::GoogleFree.as_str().to_string()),
    }
}

pub fn ping_local_libretranslate(base_url: Option<&str>) -> Result<String, String> {
    let base = base_url
        .map(libretranslate::normalize_base_url)
        .unwrap_or_else(|| DEFAULT_LIBRETRANSLATE_BASE.to_string());
    libretranslate::ping(&base)
}

#[cfg(test)]
mod tests {
    use super::{EngineId, build_context, translate};
    use crate::translate::TranslateBatchArgs;

    #[test]
    fn parses_engine_ids() {
        assert_eq!(EngineId::parse("bing-free"), EngineId::BingFree);
        assert_eq!(EngineId::parse("google-proxy"), EngineId::GoogleProxy);
        assert_eq!(
            EngineId::parse("local-libretranslate"),
            EngineId::LocalLibretranslate
        );
        assert_eq!(EngineId::parse("local-nmt"), EngineId::LocalNmt);
        assert_eq!(EngineId::parse("unknown"), EngineId::GoogleFree);
    }

    #[test]
    fn local_libretranslate_does_not_require_network() {
        assert!(!EngineId::LocalLibretranslate.requires_network());
        assert!(EngineId::GoogleFree.requires_network());
    }

    #[test]
    fn local_nmt_requires_downloaded_model() {
        let args = TranslateBatchArgs {
            texts: vec!["Hello".to_string()],
            target_language: "ru".to_string(),
            source_language: Some("en".to_string()),
            engine: Some("local-nmt".to_string()),
            lingva_base_url: None,
            local_libretranslate_url: None,
            auto_fallback: None,
        };
        let ctx = build_context(&args);
        let error = translate(EngineId::LocalNmt, &ctx).unwrap_err();
        assert!(error.contains("not installed"));
    }

    #[test]
    fn auto_source_is_not_mapped_to_target_language() {
        let args = TranslateBatchArgs {
            texts: vec!["Hello".to_string()],
            target_language: "ru".to_string(),
            source_language: Some("auto".to_string()),
            engine: Some("google-free".to_string()),
            lingva_base_url: None,
            local_libretranslate_url: None,
            auto_fallback: None,
        };
        let ctx = build_context(&args);
        assert!(ctx.source.is_none());
    }
}
