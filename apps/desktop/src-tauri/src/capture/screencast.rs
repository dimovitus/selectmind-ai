//! xdg-desktop-portal ScreenCast → PipeWire node + FD for GStreamer.
//!
//! Same Request/Response dance as [`super::portal`], but yields a live stream
//! instead of a one-shot PNG. The FD must outlive the GStreamer pipeline.

use std::collections::HashMap;
use std::os::fd::OwnedFd;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use zbus::blocking::{Connection, Proxy};
use zbus::zvariant::{OwnedObjectPath, OwnedValue, Value};

const PORTAL_DEST: &str = "org.freedesktop.portal.Desktop";
const PORTAL_PATH: &str = "/org/freedesktop/portal/desktop";

/// Bitmask: MONITOR.
const SOURCE_TYPE_MONITOR: u32 = 1;
/// Embedded cursor in the video stream.
const CURSOR_MODE_EMBEDDED: u32 = 2;

pub struct ScreencastRemote {
    pub connection: Connection,
    pub session_handle: OwnedObjectPath,
    pub node_id: u32,
    pub fd: OwnedFd,
}

impl Drop for ScreencastRemote {
    fn drop(&mut self) {
        if let Ok(session) = Proxy::new(
            &self.connection,
            PORTAL_DEST,
            self.session_handle.as_str(),
            "org.freedesktop.portal.Session",
        ) {
            let _: Result<(), _> = session.call("Close", &());
        }
    }
}

/// Open a monitor ScreenCast and return the PipeWire remote FD + node id.
///
/// Blocks on the compositor picker / permission dialog (up to `timeout`).
pub fn open_monitor_stream(timeout: Duration) -> Result<ScreencastRemote, String> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let _ = sender.send(open_monitor_stream_inner());
    });

    receiver.recv_timeout(timeout).map_err(|_| {
        "The ScreenCast portal did not answer. Check for a share-screen dialog, then retry."
            .to_string()
    })?
}

fn open_monitor_stream_inner() -> Result<ScreencastRemote, String> {
    let connection =
        Connection::session().map_err(|error| format!("D-Bus session bus unavailable: {error}"))?;

    let session_handle = create_session(&connection)?;
    select_sources(&connection, &session_handle)?;
    let node_id = start_session(&connection, &session_handle)?;
    let fd = open_pipewire_remote(&connection, &session_handle)?;

    Ok(ScreencastRemote {
        connection,
        session_handle,
        node_id,
        fd,
    })
}

fn request_token(prefix: &str) -> String {
    format!(
        "{prefix}_{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_nanos())
            .unwrap_or_default()
    )
}

fn sender_token(connection: &Connection) -> Result<String, String> {
    let unique = connection
        .unique_name()
        .map(|name| name.as_str().to_string())
        .ok_or_else(|| "D-Bus connection has no unique name".to_string())?;
    Ok(unique.trim_start_matches(':').replace('.', "_"))
}

fn create_session(connection: &Connection) -> Result<OwnedObjectPath, String> {
    let sender = sender_token(connection)?;
    let req_token = request_token("sm_sc_req");
    let sess_token = request_token("sm_sc_sess");
    let handle = format!("/org/freedesktop/portal/desktop/request/{sender}/{req_token}");

    // Subscribe before calling.
    let request = Proxy::new(
        connection,
        PORTAL_DEST,
        handle.as_str(),
        "org.freedesktop.portal.Request",
    )
    .map_err(|error| error.to_string())?;
    let mut responses = request
        .receive_signal("Response")
        .map_err(|error| error.to_string())?;

    let mut options: HashMap<&str, Value> = HashMap::new();
    options.insert("handle_token", Value::from(req_token.as_str()));
    options.insert("session_handle_token", Value::from(sess_token.as_str()));

    let screencast = Proxy::new(
        connection,
        PORTAL_DEST,
        PORTAL_PATH,
        "org.freedesktop.portal.ScreenCast",
    )
    .map_err(|error| error.to_string())?;

    let _: OwnedObjectPath = screencast
        .call("CreateSession", &(options))
        .map_err(|error| format!("ScreenCast CreateSession failed: {error}"))?;

    let message = responses
        .next()
        .ok_or_else(|| "ScreenCast CreateSession produced no response".to_string())?;
    let (code, results): (u32, HashMap<String, OwnedValue>) = message
        .body()
        .deserialize()
        .map_err(|error| error.to_string())?;
    if code != 0 {
        return Err("ScreenCast session was denied".to_string());
    }

    let handle = results
        .get("session_handle")
        .ok_or_else(|| "ScreenCast response missing session_handle".to_string())?;
    OwnedObjectPath::try_from(handle.clone()).map_err(|error| error.to_string())
}

fn select_sources(connection: &Connection, session: &OwnedObjectPath) -> Result<(), String> {
    let sender = sender_token(connection)?;
    let request_token = request_token("sm_sc_sel");
    let handle = format!("/org/freedesktop/portal/desktop/request/{sender}/{request_token}");

    let request = Proxy::new(
        connection,
        PORTAL_DEST,
        handle.as_str(),
        "org.freedesktop.portal.Request",
    )
    .map_err(|error| error.to_string())?;
    let mut responses = request
        .receive_signal("Response")
        .map_err(|error| error.to_string())?;

    let mut options: HashMap<&str, Value> = HashMap::new();
    options.insert("handle_token", Value::from(request_token.as_str()));
    options.insert("types", Value::from(SOURCE_TYPE_MONITOR));
    options.insert("multiple", Value::from(false));
    options.insert("cursor_mode", Value::from(CURSOR_MODE_EMBEDDED));

    let screencast = Proxy::new(
        connection,
        PORTAL_DEST,
        PORTAL_PATH,
        "org.freedesktop.portal.ScreenCast",
    )
    .map_err(|error| error.to_string())?;

    let _: OwnedObjectPath = screencast
        .call("SelectSources", &(session, options))
        .map_err(|error| format!("ScreenCast SelectSources failed: {error}"))?;

    let message = responses
        .next()
        .ok_or_else(|| "ScreenCast SelectSources produced no response".to_string())?;
    let (code, _results): (u32, HashMap<String, OwnedValue>) = message
        .body()
        .deserialize()
        .map_err(|error| error.to_string())?;
    if code != 0 {
        return Err("ScreenCast source selection was denied".to_string());
    }
    Ok(())
}

fn start_session(connection: &Connection, session: &OwnedObjectPath) -> Result<u32, String> {
    let sender = sender_token(connection)?;
    let request_token = request_token("sm_sc_start");
    let handle = format!("/org/freedesktop/portal/desktop/request/{sender}/{request_token}");

    let request = Proxy::new(
        connection,
        PORTAL_DEST,
        handle.as_str(),
        "org.freedesktop.portal.Request",
    )
    .map_err(|error| error.to_string())?;
    let mut responses = request
        .receive_signal("Response")
        .map_err(|error| error.to_string())?;

    let mut options: HashMap<&str, Value> = HashMap::new();
    options.insert("handle_token", Value::from(request_token.as_str()));

    let screencast = Proxy::new(
        connection,
        PORTAL_DEST,
        PORTAL_PATH,
        "org.freedesktop.portal.ScreenCast",
    )
    .map_err(|error| error.to_string())?;

    // Empty parent window — works for tray / tucked main window.
    let _: OwnedObjectPath = screencast
        .call("Start", &(session, "", options))
        .map_err(|error| format!("ScreenCast Start failed: {error}"))?;

    let message = responses
        .next()
        .ok_or_else(|| "ScreenCast Start produced no response".to_string())?;
    let (code, results): (u32, HashMap<String, OwnedValue>) = message
        .body()
        .deserialize()
        .map_err(|error| error.to_string())?;
    if code != 0 {
        return Err("ScreenCast start was denied".to_string());
    }

    parse_first_stream_node_id(&results)
}

fn parse_first_stream_node_id(results: &HashMap<String, OwnedValue>) -> Result<u32, String> {
    let streams = results
        .get("streams")
        .ok_or_else(|| "ScreenCast Start response missing streams".to_string())?;

    // streams: a(ua{sv})
    let value = streams.clone();
    let parsed: Vec<(u32, HashMap<String, OwnedValue>)> = value
        .try_into()
        .map_err(|error| format!("Failed to parse ScreenCast streams: {error}"))?;
    parsed
        .into_iter()
        .next()
        .map(|(node_id, _)| node_id)
        .ok_or_else(|| "ScreenCast returned no streams — pick a monitor in the dialog".to_string())
}

fn open_pipewire_remote(
    connection: &Connection,
    session: &OwnedObjectPath,
) -> Result<OwnedFd, String> {
    let options: HashMap<&str, Value> = HashMap::new();
    let screencast = Proxy::new(
        connection,
        PORTAL_DEST,
        PORTAL_PATH,
        "org.freedesktop.portal.ScreenCast",
    )
    .map_err(|error| error.to_string())?;

    let fd: zbus::zvariant::OwnedFd = screencast
        .call("OpenPipeWireRemote", &(session, options))
        .map_err(|error| format!("OpenPipeWireRemote failed: {error}"))?;

    Ok(OwnedFd::from(fd))
}
