# Live game translate (killer feature)



> **Separate mode** — does not replace OCR toolbar, OCR chat, or selection toolbar.



## What it does



1. Pick a screen region once (dialog/subtitle area in a game).

2. Toggle live mode with **`Ctrl+Shift+L`** (configurable).

3. SelectMind captures that region in a loop, runs **Windows OCR with line boxes**, translates via a free online engine (default: Google), and draws translated text **on top of the game** in a click-through overlay.



## Hotkeys



| Default | Action |

|---------|--------|

| `Ctrl+Shift+L` | Toggle live translate on/off |

| `Ctrl+Shift+Left` | Previous saved region |

| `Ctrl+Shift+Right` | Next saved region |



First toggle → region picker if no region saved. Saved regions persist across app restarts (up to 5).



## Settings



**Settings → General → Live game translate**



- Translation engine (Google / Bing / Lingva / LibreTranslate / Offline Argos / AI)

- Auto-fallback when primary engine fails

- Target language
- Source language (default English for games; auto-detect for online engines)

- Poll interval (ms) — default 450 online / 300 offline

- Translation cache — max 500 entries, 24h TTL (LRU eviction)

- Overlay opacity / font scale

- Max translation requests per minute (cost guard)

- Saved regions list + cycle / pick / reset

- Clear translation cache



## Architecture (isolated)



```

Rust (new)                         TypeScript (new)

├── ocr/lines.rs      fast OCR + line boxes

├── live/mod.rs       region store + frame hash + scan

├── translate/        engine registry + online/offline backends

├── capture/mod.rs    + capture_monitor_region_rgba (additive)

└── lib.rs            live_* commands only



├── live/live-controller.ts       poll loop + stability filter

├── live/live-region-store.ts     persisted region history (localStorage)

├── live/live-translate.service.ts batch translate + cache

├── live/LiveOverlayApp.tsx       click-through overlay + engine badge

└── live/init-live-translate.ts   hotkey registration

```



Legacy `ocr/win.rs` (`recognize_data_url`) is **unchanged**.



## Limitations



- **Exclusive fullscreen** — overlay may not appear; use borderless windowed.

- **Anti-cheat** — screen capture + overlay may trigger competitive anti-cheat; single-player recommended.



## Gaming checklist



| Check | Recommendation |

|-------|----------------|

| Display mode | Borderless windowed (not exclusive fullscreen) |

| Anti-cheat / competitive | Avoid live overlay; use offline single-player only |

| Subtitle region | Pick a tight region above dialogue/subtitles |

| Source language | English for most imported games |

| Offline play | Download Argos model + choose Offline NMT |

| Performance | Offline polling defaults to 300 ms; reduce region size if needed |

| Rate limits | Keep auto-fallback enabled for online engines |



### Translation engine (default: Google free)



Live translate uses a **separate translation layer** — your AI providers are untouched.



| Engine | Key required |

|--------|----------------|

| **Google Translate (free)** | No — default |

| **Bing / Microsoft (free)** | No — unofficial web endpoint (Yolochka-style) |

| Google via Lingva proxy | No — fallback on rate limit |

| **LibreTranslate (local server)** | No — run LibreTranslate on localhost (default `http://127.0.0.1:5000`) |

| **Offline NMT (Argos)** | No — download model + bundled sidecar |

| Offline sidecar | Bundled `selectmind-argos` (Python fallback in dev) |

| AI provider | Yes — optional |



Configure in **Settings → Live game translate**.



**Auto-fallback:** when enabled, offline Argos failures fall back to Bing then Google. Bing failures fall back to Google (then Lingva). Google free already falls back to Lingva on rate limit. LibreTranslate failures fall back to Google when the local server is down.



### LibreTranslate (offline spike, v0.2)



1. Install and run [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) locally, e.g. `docker run -p 5000:5000 libretranslate/libretranslate`.

2. In **Settings → Live game translate**, choose **LibreTranslate (local server)**.

3. Set server URL if not using default `http://127.0.0.1:5000`, then click **Test connection**.

4. Toggle live translate — overlay badge shows `LibreTranslate` when the local server responds.



Bundled Argos sidecar runs automatically when you choose **Offline NMT (Argos)**. Release builds include `selectmind-argos.exe`; dev uses Python if available.



### Offline models (Argos)



1. Open **Settings → Live game translate → Offline translation models**.

2. Click **Download** on **English → Russian** (~100 MB). Files are stored in `%APPDATA%/SelectMind/models/`.

3. Dev only: `pip install -r apps/desktop/sidecar/requirements.txt`

4. Click **Test offline engine** — starts the Argos sidecar and verifies the model loads.

5. Set **Source language** to English, **Target language** to Russian, engine **Offline NMT (Argos)**.

6. Toggle live translate (`Ctrl+Shift+L`) — overlay badge shows **Offline**.



- **Typewriter dialogs** — lines must appear stable for 2 frames before translation (avoids half-rendered text).



## Smoke test



1. No API key required for default Google/Bing engines.

2. Open a game or app with on-screen English text (borderless/windowed).

3. Press `Ctrl+Shift+L` → draw region over subtitle area.

4. Overlay should show translated lines with engine badge (e.g. `Google`).

5. Press `Ctrl+Shift+Right` to switch to another saved region if configured.

6. Press `Ctrl+Shift+L` to stop — overlay hides; OCR toolbar (`Ctrl+Shift+O`) still works as before.


