use keyring::Entry;

const SERVICE_NAME: &str = "SelectMind AI";

fn entry_for(provider_id: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, provider_id).map_err(|error| error.to_string())
}

fn is_missing_entry(error: &keyring::Error) -> bool {
    matches!(error, keyring::Error::NoEntry)
}

pub fn store_api_key(provider_id: &str, api_key: &str) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key must not be empty".to_string());
    }

    entry_for(provider_id)?
        .set_password(api_key)
        .map_err(|error| error.to_string())
}

pub fn get_api_key(provider_id: &str) -> Result<Option<String>, String> {
    match entry_for(provider_id)?.get_password() {
        Ok(key) if key.is_empty() => Ok(None),
        Ok(key) => Ok(Some(key)),
        Err(error) if is_missing_entry(&error) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn delete_api_key(provider_id: &str) -> Result<(), String> {
    match entry_for(provider_id)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(error) if is_missing_entry(&error) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn has_api_key(provider_id: &str) -> Result<bool, String> {
    Ok(get_api_key(provider_id)?.is_some())
}
