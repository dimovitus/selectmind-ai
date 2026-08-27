/// Map human-readable labels and ISO codes to Google Translate `tl` codes.
pub fn resolve_language_code(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return "ru".to_string();
    }

    if trimmed.len() == 2 || trimmed.len() == 5 {
        let lower = trimmed.to_lowercase();
        if lower.chars().all(|c| c.is_ascii_alphabetic() || c == '-') {
            return lower.split('-').next().unwrap_or(&lower).to_string();
        }
    }

    static MAP: &[(&str, &str)] = &[
        ("english", "en"),
        ("ukrainian", "uk"),
        ("russian", "ru"),
        ("german", "de"),
        ("french", "fr"),
        ("spanish", "es"),
        ("polish", "pl"),
        ("italian", "it"),
        ("portuguese", "pt"),
        ("japanese", "ja"),
        ("chinese", "zh-CN"),
        ("korean", "ko"),
    ];

    let key = trimmed.to_lowercase();
    for (name, code) in MAP {
        if key == *name {
            return code.to_string();
        }
    }

    trimmed.to_lowercase()
}

/// Returns `None` for auto-detect; otherwise a normalized ISO-ish code for the source language.
pub fn resolve_source_language(input: Option<&str>) -> Option<String> {
    let raw = input?.trim();
    if raw.is_empty() {
        return None;
    }

    let lower = raw.to_lowercase();
    if lower == "auto" || lower == "auto-detect" {
        return None;
    }

    Some(resolve_language_code(raw))
}

#[cfg(test)]
mod tests {
    use super::{resolve_language_code, resolve_source_language};

    #[test]
    fn resolves_names_and_codes() {
        assert_eq!(resolve_language_code("Russian"), "ru");
        assert_eq!(resolve_language_code("ru"), "ru");
        assert_eq!(resolve_language_code("en"), "en");
        assert_eq!(resolve_language_code("zh"), "zh");
    }

    #[test]
    fn auto_source_means_detect() {
        assert_eq!(resolve_source_language(Some("auto")), None);
        assert_eq!(resolve_source_language(Some("auto-detect")), None);
        assert_eq!(resolve_source_language(Some("en")), Some("en".to_string()));
    }
}
