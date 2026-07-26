#[derive(Debug, Clone)]
pub struct CatalogEntry {
    pub id: &'static str,
    pub from_code: &'static str,
    pub from_name: &'static str,
    pub to_code: &'static str,
    pub to_name: &'static str,
    pub package_version: &'static str,
    pub download_url: &'static str,
    pub size_bytes: u64,
}

/// Curated Argos Translate packages (from argospm-index).
pub fn catalog() -> &'static [CatalogEntry] {
    &[
        CatalogEntry {
            id: "translate-en_ru",
            from_code: "en",
            from_name: "English",
            to_code: "ru",
            to_name: "Russian",
            package_version: "1.9",
            download_url: "https://argos-net.com/v1/translate-en_ru-1_9.argosmodel",
            size_bytes: 102_400_000,
        },
        CatalogEntry {
            id: "translate-en_de",
            from_code: "en",
            from_name: "English",
            to_code: "de",
            to_name: "German",
            package_version: "1.9",
            download_url: "https://argos-net.com/v1/translate-en_de-1_9.argosmodel",
            size_bytes: 102_400_000,
        },
        CatalogEntry {
            id: "translate-en_uk",
            from_code: "en",
            from_name: "English",
            to_code: "uk",
            to_name: "Ukrainian",
            package_version: "1.9",
            download_url: "https://argos-net.com/v1/translate-en_uk-1_9.argosmodel",
            size_bytes: 102_400_000,
        },
    ]
}

pub fn find_by_id(id: &str) -> Option<&'static CatalogEntry> {
    catalog().iter().find(|entry| entry.id == id)
}

pub fn find_by_pair(from_code: &str, to_code: &str) -> Option<&'static CatalogEntry> {
    let from = from_code.trim().to_lowercase();
    let to = to_code.trim().to_lowercase();
    catalog().iter().find(|entry| entry.from_code == from && entry.to_code == to)
}

#[cfg(test)]
mod tests {
    use super::{catalog, find_by_id, find_by_pair};

    #[test]
    fn catalog_has_en_ru() {
        let entry = find_by_id("translate-en_ru").expect("en→ru model");
        assert_eq!(entry.from_code, "en");
        assert_eq!(entry.to_code, "ru");
        assert!(catalog().len() >= 3);
    }

    #[test]
    fn finds_pair_lookup() {
        assert!(find_by_pair("en", "ru").is_some());
        assert!(find_by_pair("EN", "RU").is_some());
        assert!(find_by_pair("fr", "de").is_none());
    }
}
