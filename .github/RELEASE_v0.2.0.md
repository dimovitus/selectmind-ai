## SelectMind AI Desktop v0.2.0 for Windows (x64)

**Live game translate** — real-time OCR overlay for games, with online and offline translation engines.

### Install

1. Download **SelectMind AI_0.2.0_x64-setup.exe** below
2. Run the installer
3. Open **Settings → Live game translate** (or add an AI provider key for other features)

### What's new in v0.2.0

#### Live game translate (killer feature)

- Pick a screen region once, toggle with **`Ctrl+Shift+L`**
- Windows OCR with line boxes → translated text overlay (click-through)
- Saved regions (up to 5) + hotkeys to cycle regions
- Stability filter — waits 2 frames before translating typewriter dialogs

#### Translation engines

| Engine | Internet | Notes |
|--------|----------|-------|
| **Google Translate (free)** | Yes | Default · batch · auto-fallback to Lingva |
| **Bing / Microsoft (free)** | Yes | Yolochka-style unofficial endpoint |
| **Google via Lingva proxy** | Yes | Proxy when Google rate-limits |
| **LibreTranslate (local)** | No* | Run LibreTranslate on localhost |
| **Offline NMT (Argos)** | No | Download model (~100 MB) + bundled sidecar |
| **AI provider** | Yes | Optional · uses your configured provider |

\*LibreTranslate local server runs on your machine.

#### Offline setup (Argos)

1. **Settings → Live game translate → Offline translation models**
2. Download **English → Russian** (~100 MB)
3. Dev: `pip install -r apps/desktop/sidecar/requirements.txt`
4. **Test offline engine** → select **Offline NMT (Argos)**
5. Source: English · Target: Russian · `Ctrl+Shift+L`

Release builds can bundle `selectmind-argos.exe` (see `apps/desktop/sidecar/README.md`).

#### Other improvements

- Auto-fallback chains (Offline → Bing → Google, Bing → Google → Lingva, …)
- Translation cache LRU (500 entries, 24h TTL)
- Source language setting (default English for games)
- Overlay shows engine badge and error messages (rate limit, sidecar down, …)
- 17+ Vitest tests + expanded Rust translate tests

Full docs: [`docs/DESKTOP_LIVE_TRANSLATE.md`](../docs/DESKTOP_LIVE_TRANSLATE.md)

### Default hotkeys

| Hotkey | Action |
|--------|--------|
| `Ctrl+Shift+L` | Toggle live game translate |
| `Ctrl+Shift+Left` / `Right` | Previous / next saved region |
| `Ctrl+Shift+Space` | Toolbar for selected text |
| `Ctrl+Shift+O` | OCR toolbar (games, images) |
| `Ctrl+Shift+X` | OCR to chat |
| `Ctrl+Shift+P` | Command palette |

All hotkeys configurable in **Settings → Keyboard shortcuts**.

### SmartScreen notice

This build is **unsigned** (no code signing certificate yet). Windows may show "Unknown publisher" — click **More info**, then **Run anyway**. Install only from this GitHub Release.

### Requirements

- Windows 10/11 x64
- Windows OCR language pack (Settings → Time & language)
- Internet for online translation engines (not required for offline Argos)
- Borderless windowed mode recommended for games (exclusive fullscreen may hide overlay)

### Gaming / anti-cheat

Screen capture and overlays may trigger competitive anti-cheat. Use in **single-player / offline** games. See gaming checklist in [`DESKTOP_LIVE_TRANSLATE.md`](../docs/DESKTOP_LIVE_TRANSLATE.md).

### Upgrade from v0.1.0

Settings and conversations are preserved. Live translate settings are new — no migration needed. OCR toolbar and selection features unchanged.

### Chrome extension

Still at v0.1.0 — install from source or Chrome Web Store. See [README](https://github.com/dimovitus/selectmind-ai#install-development).
