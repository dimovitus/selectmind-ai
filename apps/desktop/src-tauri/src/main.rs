// Hide the console window on Windows release builds (GUI app).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    apply_linux_display_workaround();
    selectmind_desktop_lib::run()
}

/// GTK3 / WebKitGTK on native Wayland often dies with Gdk error 71 (EPROTO)
/// when creating transparent always-on-top overlay windows. Prefer XWayland
/// when it is available. Also disable WebKit's DMA-BUF / compositing paths —
/// without that, KDE Wayland routinely paints a solid black main window while
/// the tray icon still looks healthy.
fn apply_linux_display_workaround() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            set_env("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            set_env("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }

        // Force XWayland whenever an X display exists — even over an inherited
        // GDK_BACKEND=wayland. Native Wayland breaks overlays (Gdk error 71),
        // global hotkeys, and window raising for this app. Opt out explicitly
        // with SELECTMIND_NATIVE_WAYLAND=1.
        let x11 = std::env::var_os("DISPLAY").is_some();
        let opt_out = std::env::var_os("SELECTMIND_NATIVE_WAYLAND").is_some();
        if x11 && !opt_out {
            let backend = std::env::var("GDK_BACKEND").unwrap_or_default();
            if backend != "x11" {
                if !backend.is_empty() {
                    eprintln!(
                        "[selectmind] Overriding GDK_BACKEND={backend} with x11 (overlays/hotkeys require XWayland)"
                    );
                }
                set_env("GDK_BACKEND", "x11");
            }
        }
    }
}

#[cfg(target_os = "linux")]
fn set_env(key: &str, value: &str) {
    // SAFETY: called from `main` before GTK, WebKit, or any worker threads start.
    unsafe { std::env::set_var(key, value) };
}
