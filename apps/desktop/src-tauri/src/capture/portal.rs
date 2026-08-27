//! Screen capture through `xdg-desktop-portal`.
//!
//! `xcap` grabs Wayland frames with `wlr-screencopy`, which KWin and Mutter do
//! not implement — the capture comes back empty or black there. The portal is
//! the only interface every Wayland compositor supports.

use std::collections::HashMap;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use image::RgbaImage;
use zbus::blocking::{Connection, Proxy};
use zbus::zvariant::{OwnedObjectPath, OwnedValue, Value};

const PORTAL_DEST: &str = "org.freedesktop.portal.Desktop";
const PORTAL_PATH: &str = "/org/freedesktop/portal/desktop";

/// Full desktop screenshot. The first call usually raises a permission prompt,
/// so the timeout has to allow for a human answering it.
pub fn screenshot(timeout: Duration) -> Result<RgbaImage, String> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let _ = sender.send(capture());
    });

    receiver.recv_timeout(timeout).map_err(|_| {
        "The desktop portal did not answer the screenshot request. Check for an \
         open screenshot/permission dialog, close other screenshot tools (e.g. \
         Flameshot), or restart the portal: systemctl --user restart \
         plasma-xdg-desktop-portal-kde xdg-desktop-portal"
            .to_string()
    })?
}

fn capture() -> Result<RgbaImage, String> {
    let connection =
        Connection::session().map_err(|error| format!("D-Bus session bus unavailable: {error}"))?;

    let unique = connection
        .unique_name()
        .map(|name| name.as_str().to_string())
        .ok_or_else(|| "D-Bus connection has no unique name".to_string())?;
    let sender = unique.trim_start_matches(':').replace('.', "_");
    let token = format!(
        "selectmind_{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_nanos())
            .unwrap_or_default()
    );
    let handle = format!("/org/freedesktop/portal/desktop/request/{sender}/{token}");

    // Subscribe before calling: the portal may answer before the call returns.
    let request = Proxy::new(
        &connection,
        PORTAL_DEST,
        handle.as_str(),
        "org.freedesktop.portal.Request",
    )
    .map_err(|error| error.to_string())?;
    let mut responses = request
        .receive_signal("Response")
        .map_err(|error| error.to_string())?;

    let mut options: HashMap<&str, Value> = HashMap::new();
    options.insert("handle_token", Value::from(token.as_str()));
    options.insert("interactive", Value::from(false));
    options.insert("modal", Value::from(false));

    let screenshot = Proxy::new(
        &connection,
        PORTAL_DEST,
        PORTAL_PATH,
        "org.freedesktop.portal.Screenshot",
    )
    .map_err(|error| error.to_string())?;

    let _: OwnedObjectPath = screenshot
        .call("Screenshot", &("", options))
        .map_err(|error| format!("Screenshot portal call failed: {error}"))?;

    let message = responses
        .next()
        .ok_or_else(|| "Screenshot portal closed without a response".to_string())?;

    let (code, results): (u32, HashMap<String, OwnedValue>) = message
        .body()
        .deserialize()
        .map_err(|error| error.to_string())?;

    if code != 0 {
        return Err("Screen capture was denied in the desktop portal dialog".to_string());
    }

    let uri = results
        .get("uri")
        .ok_or_else(|| "Portal response contained no image URI".to_string())?;
    let uri = String::try_from(uri.clone()).map_err(|error| error.to_string())?;
    let path = uri.strip_prefix("file://").unwrap_or(uri.as_str());
    let path = urlencoding::decode(path)
        .map_err(|error| error.to_string())?
        .into_owned();

    // KDE writes the frame into the user's Pictures folder; never leave it behind.
    let image = image::open(&path);
    let _ = std::fs::remove_file(&path);

    Ok(image
        .map_err(|error| format!("Failed to read portal screenshot: {error}"))?
        .to_rgba8())
}
