# SelectMind Desktop on Linux

Linux is a first-class desktop target (Tauri 2 + GTK/WebKit). Windows remains the most complete platform (UIA auto-toolbar, capture exclusion). This page is the Arch-oriented setup for the rest.

## Arch packages

```bash
sudo pacman -S --needed \
  rustup \
  npm \
  webkit2gtk-4.1 \
  gtk3 \
  libayatana-appindicator \
  librsvg \
  openssl \
  pkgconf \
  clang \
  base-devel \
  tesseract \
  tesseract-data-eng \
  tesseract-data-rus \
  xdg-desktop-portal \
  xdg-desktop-portal-gtk \
  gstreamer \
  gst-plugins-base \
  gst-plugin-pipewire
```

Optional but useful:

```bash
# npm shims after a copied node_modules tree
node scripts/fix-unix-bins.mjs

# X11 / XWayland: synthesize Ctrl+C for the toolbar hotkey
sudo pacman -S --needed xdotool

# Native Wayland: same, if your compositor supports it
sudo pacman -S --needed wtype wl-clipboard

# Hyprland / Sway screen capture portal
sudo pacman -S --needed xdg-desktop-portal-wlr
# GNOME / KDE already ship their own portal
```

Then:

```bash
rustup default stable
npm install
npm run desktop:dev
```

Installer / bundles:

```bash
npm run desktop:package
# → apps/desktop/src-tauri/target/release/bundle/deb
# → apps/desktop/src-tauri/target/release/bundle/appimage
```

API keys use **Secret Service** (GNOME Keyring, KWallet, or another `org.freedesktop.secrets` provider).

## What works

| Feature | Linux |
|---------|--------|
| Chat, providers, pipelines, settings | Yes |
| Global hotkeys + tray + autostart | Yes (`.desktop` autostart) |
| Region capture + OCR chat / OCR toolbar | Yes (desktop portal + Tesseract) |
| Manual toolbar hotkey (`Ctrl+Shift+Space`) | Yes — Ctrl+C / clipboard |
| Live game translate | Yes — Tesseract line boxes; Continuous via GStreamer pipewiresrc when `gst-plugin-pipewire` is installed |
| Offline Argos sidecar | Yes (`python3` + argostranslate) |
| Auto-toolbar on highlight | No (Windows UIA only) |
| Hide overlay from capture | No OS exclusion — **software mask** paints black over last overlay boxes in the capture buffer (overlay stays visible) |

## Wayland notes

This machine typically has both `WAYLAND_DISPLAY` and `DISPLAY` (XWayland).

On Linux the app sets `GDK_BACKEND=x11` (when `DISPLAY` is present), `WEBKIT_DISABLE_DMABUF_RENDERER=1`, and `WEBKIT_DISABLE_COMPOSITING_MODE=1` unless you already exported those. Without the WebKit flags, KDE Wayland often shows a solid black main window while the tray icon still works. GTK3 transparent overlays otherwise crash with `Gdk-Message: Error 71` on native Wayland.

To try native Wayland anyway:

```bash
GDK_BACKEND=wayland npm run desktop:dev
```

If the window is blank or still dies:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run desktop:dev
```

- **Screen capture** goes through `org.freedesktop.portal.Screenshot`. The compositor may prompt once; deny it and OCR/live translate stay blank. Verify the portal answers with:

  ```bash
  gdbus introspect --session --dest org.freedesktop.portal.Desktop \
    --object-path /org/freedesktop/portal/desktop | grep portal.Screenshot
  ```

- **OCR / region picker** freezes a screenshot into the overlay. WebKitGTK cannot paint a transparent fullscreen window (it shows a black panel). Drag a rectangle on that freeze-frame — do not select text in the app underneath.
- **Exclusive fullscreen games** often cannot be captured or overlaid — use borderless windowed.
- **Toolbar hotkey:** `wtype` / `xdotool` try to send Ctrl+C. If the compositor blocks synthetic keys, copy the text first, then press the hotkey (clipboard fallback).
- **Transparent overlays** depend on the compositor. If the picker or live overlay is an opaque black panel, try X11 session or another compositor.

## Why not `xcap` on Linux

`xcap`'s Linux build depends on `pipewire`/`libspa`, whose generated bindings do not compile against PipeWire ≥ 1.4 headers (`cannot find value SPA_ID_INVALID in crate spa_sys`), and its Wayland frame grabber uses `wlr-screencopy`, which KWin and Mutter do not implement. Linux therefore uses its own backend:

- **Monitor geometry** — Tauri/GDK (`available_monitors`, `monitor_from_point`), queried on the GTK main thread.
- **Frames** — `xdg-desktop-portal` screenshots, cropped per monitor and cached for 400 ms so live translate does not raise one portal request per poll. Acceptable for on-demand; **too slow for true Continuous** (~2.5 FPS ceiling).

### Continuous capture via GStreamer (Linux)

Continuous mode uses **portal ScreenCast → PipeWire FD → GStreamer `pipewiresrc`**, not portal
Screenshot. That avoids thrashing the compositor and bypasses xcap’s PipeWire ≥1.4 compile break
(GStreamer loads libpipewire inside the plugin).

Arch packages:

```bash
sudo pacman -S --needed gst-plugin-pipewire gstreamer gst-plugins-base
```

Then restart the app. Settings → Live game translate will enable Continuous when
`live_continuous_capture_available` reports true. The first Continuous start shows the system
share-screen dialog once; stop live translate to tear the stream down.

On-demand (hotkey) still uses portal Screenshot + 400 ms cache.

Scaffold / implementation: `capture/screencast.rs`, `capture/gstreamer_pipewire.rs`.

`xcap` is still used on Windows and macOS.

Capture, OCR, and toolbar commands are declared `#[tauri::command(async)]`: they must not run on the GTK main thread, or the portal round-trip would freeze the UI and the overlay hand-off would deadlock.

## OCR

Live translate prefers **in-process Tesseract** via `leptess` (reused engine, PNG in memory). The `tesseract` CLI (`--psm 6 tsv`) remains a fallback if in-process init fails. Tesseract.js remains available for the settings “Tesseract.js only” engine.

Language packs map from the UI codes (`en` → `eng`, `ru` → `rus`, `ja` → `jpn`, …). The OCR toolbar has no language picker, so it passes every installed `traineddata` (up to four, English first) to Tesseract — install only the packs you need.
