# SelectMind Desktop — Release & Distribution

> Phase 6 — build, sign, and ship the Windows desktop app.

## Prerequisites

- Windows 10/11 x64
- [Rust toolchain](https://rustup.rs/)
- Node.js 20+
- NSIS (installed automatically by Tauri bundler on first build)

## Build installer (unsigned)

From repo root:

```bash
npm run desktop:package
```

Or manually:

```bash
npm run build:desktop
cd apps/desktop/src-tauri && cargo tauri build
```

**Output:**

| Artifact | Path |
|----------|------|
| NSIS setup `.exe` | `apps/desktop/src-tauri/target/release/bundle/nsis/SelectMind AI_*_x64-setup.exe` |
| Portable binary | `apps/desktop/src-tauri/target/release/selectmind-desktop.exe` |

Unsigned builds trigger **Windows SmartScreen** (“Unknown publisher”) on first install.

## Code signing (SmartScreen)

1. **OV or EV code signing certificate** (DigiCert, Sectigo, …)
2. Sign after build:

```powershell
signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 `
  /f "path\to\cert.pfx" /p "password" `
  "apps\desktop\src-tauri\target\release\bundle\nsis\SelectMind AI_0.2.0_x64-setup.exe"
```

Tauri updater keys: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Auto-updates (planned)

Requires signed artifacts + HTTPS `latest.json` endpoint + `tauri-plugin-updater` (not wired yet).

Until then: manual installs from GitHub Releases.

## Version bump checklist

1. Bump version in `package.json`, `apps/desktop/package.json`, `Cargo.toml`, `tauri.conf.json`
2. `npm run desktop:package`
3. Smoke test (below)
4. Sign installer
5. Publish Release

## Smoke test

Run after install or `npm run desktop:dev`.

### Core

| # | Check | Pass |
|---|--------|:----:|
| 1 | App starts; onboarding or workspace loads | ☐ |
| 2 | Settings → Providers → save API key → **Enabled · key saved** | ☐ |
| 3 | Close window → hides to tray; left-click tray icon restores | ☐ |
| 4 | Tray → Quit exits cleanly | ☐ |

### Hotkeys (defaults — or your custom bindings)

| # | Check | Pass |
|---|--------|:----:|
| 5 | `Ctrl+Shift+P` → command palette | ☐ |
| 6 | `Ctrl+Shift+X` → pick region → OCR chat opens | ☐ |
| 7 | `Ctrl+Shift+O` → pick region → toolbar with OCR text | ☐ |
| 8 | `Ctrl+Shift+Space` → toolbar for selected text (any app) | ☐ |
| 9 | Hotkeys work while main window is in tray | ☐ |

### Selection overlay

| # | Check | Pass |
|---|--------|:----:|
| 10 | Select text in Notepad → auto toolbar appears | ☐ |
| 11 | Explain → popup streams answer | ☐ |
| 12 | Follow-up message in popup gets a reply | ☐ |
| 13 | Expand (⤢) opens conversation in main window | ☐ |
| 14 | Drag / resize popup; size persists in session | ☐ |

### OCR / capture

| # | Check | Pass |
|---|--------|:----:|
| 15 | OCR from open chat does **not** capture the app window | ☐ |
| 16 | OCR toolbar works on static text (game subtitle / image) | ☐ |

### Settings

| # | Check | Pass |
|---|--------|:----:|
| 17 | Settings → Keyboard shortcuts → change binding → works immediately | ☐ |
| 18 | Settings → Toolbar → customize icons → reflected in overlay | ☐ |
| 19 | Import/export backup round-trip | ☐ |

### Live game translate (v0.2)

| # | Check | Pass |
|---|--------|:----:|
| 20 | `Ctrl+Shift+L` → pick region → overlay shows translated lines | ☐ |
| 21 | Engine badge visible (Google / Offline / …) | ☐ |
| 22 | `Ctrl+Shift+Right` cycles saved regions | ☐ |
| 23 | Offline: model downloaded → Test offline engine → Offline NMT works | ☐ |
| 24 | Auto-fallback: disable sidecar/model → online fallback or error in overlay | ☐ |
| 25 | Clear translation cache → count resets in Settings | ☐ |

See [DESKTOP_LIVE_TRANSLATE.md](./DESKTOP_LIVE_TRANSLATE.md) for engine setup and gaming checklist.

See also [DESKTOP_CAPTURE.md](./DESKTOP_CAPTURE.md) for gaming / anti-cheat notes.
