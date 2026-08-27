# SelectMind AI

**Chrome extension, Firefox/Zen extension, and desktop app (Windows / Linux)** — one AI core, three clients.

| Client | Platform | Use case |
|--------|----------|----------|
| **Chrome extension** | Manifest V3 | AI toolbar on any webpage, side panel, page context |
| **Firefox / Zen extension** | Manifest V3 | Same UI via sidebar (`npm run build:firefox`) |
| **Windows desktop app** | Tauri 2 | System-wide toolbar, OCR, **live game translate**, tray + global hotkeys |
| **Linux desktop app** | Tauri 2 (Arch-first) | Same shell; Tesseract OCR; toolbar via hotkey (no UIA auto-detect) |

Select text, run Explain / Translate / Summarize / custom actions from a floating toolbar, and keep chatting in a resizable popup. Connect your own provider (OpenAI, Anthropic, Gemini, Ollama, …). Keys stay local; requests go directly to the API you configure.

---

## Highlights

- **Select & act** — Highlight text and run Explain, Translate, Summarize, Rewrite, and 30+ built-in actions from a floating toolbar.
- **Chat in place** — Continue the conversation in the same popup: ask follow-ups, resize the window, drag it anywhere.
- **Side panel workspace** — Open any thread in a dedicated workspace with conversation history.
- **Command palette** — Press `Ctrl+Shift+P` to fuzzy-search actions and pipelines from anywhere.
- **Your providers** — OpenAI, Anthropic, Gemini, Ollama, and any OpenAI-compatible API. Keys are encrypted locally.
- **Custom workflows** — Create actions, categories, multi-step pipelines, toolbar layouts, and keyboard shortcuts.
- **Context-aware** — Selected text, page title, and URL are sent to the model; add more selections to context on the fly.
- **Privacy-first** — Conversations and settings stay in your browser (IndexedDB). Requests go directly to the provider you configure.

---

## How it works

1. **Select text** on any website.
2. **Click an action** in the floating toolbar (or use `Ctrl+Shift+P`).
3. **Read the answer** in a popup — stream live, copy, or keep chatting.
4. **Optional:** open the side panel for a larger workspace and past conversations.

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Open command palette |
| `Ctrl+Shift+S` | Toggle side panel |
| `Enter` | Send message in chat popup |
| `Shift+Enter` | New line in chat input |

---

## Supported providers

| Provider | Notes |
|----------|--------|
| OpenAI | GPT-4o, GPT-4o mini, etc. |
| Anthropic | Claude 3.5 / 4 |
| Google Gemini | Gemini 1.5 / 2 |
| Groq | Fast Llama / Mixtral inference |
| Mistral AI | Mistral models |
| DeepSeek | DeepSeek Chat / Reasoner |
| xAI (Grok) | Grok models |
| OpenRouter | 100+ models via one API key |
| Together AI | Open-source model hosting |
| Perplexity | Sonar search models |
| Fireworks AI | Fast open-weight models |
| Ollama | Local models |
| LM Studio | Local server (OpenAI-compatible) |
| LocalAI | Self-hosted OpenAI-compatible API |
| Custom | Any OpenAI-compatible base URL |

Configure providers and API keys in **Extension options** after install.

---

## Install (development)

**Requirements:** Node.js 20+, Google Chrome (or Firefox / Zen — see below)

```bash
git clone https://github.com/Dimovitus/selectmind-ai.git
cd selectmind-ai
npm install
node scripts/generate-icons.mjs
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist` folder
4. Open **SelectMind AI → Settings**, add a provider and API key
5. Visit any page, select text, and use the toolbar

### Firefox / Zen

```bash
npm run build:firefox
```

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** and select `dist-firefox/manifest.json`
3. Open Settings, add a provider and API key

Details and shortcuts: [`docs/FIREFOX.md`](docs/FIREFOX.md)

For hot reload during Chrome development:

```bash
npm run dev
```

---

## Settings & data

- **Options page** — Providers, actions, toolbar, pipelines, language, theme, import/export.
- **Response language** — Auto-detect from selection or choose a fixed language (e.g. Ukrainian, Russian, English).
- **Backup** — Export/import actions, categories, pipelines, and settings as JSON.
- **Retention** — Old conversations are cleaned up automatically based on your retention setting.

---

## Project structure

```
selectmind-ai/
├── src/                 # Browser extension (content, background, options, side panel)
├── apps/desktop/        # Tauri 2 desktop (Windows / Linux): overlay, OCR, live translate, tray, SQLite
├── packages/core/       # Domain, use cases, ports (shared by extension + desktop)
├── packages/shared/     # Constants, i18n, hotkey helpers
└── docs/                # Firefox, Linux desktop, live translate, store listing
```

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Extension dev build with HMR |
| `npm run build` | Extension production build → `dist/` |
| `npm run build:firefox` | Firefox / Zen build → `dist-firefox/` |
| `npm run package:firefox` | Zip `dist-firefox` for sideload / AMO |
| `npm run desktop:dev` | Desktop app with hot reload |
| `npm run desktop:package` | Windows NSIS installer (unsigned) |
| `npm run test` | Unit tests (root + workspaces) |
| `npm run desktop:test` | Desktop-only Vitest |
| `npm run test:e2e` | E2E smoke tests (Playwright) |
| `npm run lint` | ESLint |

**Stack:** TypeScript, React, Vite, Tailwind, Zustand, React Query, Dexie (extension), SQLite (desktop), Tauri 2 / Rust (desktop).

Architecture: **UI → use cases → domain → ports → adapters** — extension and desktop each ship platform adapters for the same `@selectmind/core`.

---

## Desktop app (Windows / Linux)

**Windows:** Node.js 20+, Rust toolchain, Windows 10/11 x64

**Linux (Arch):** see [`docs/DESKTOP_LINUX.md`](docs/DESKTOP_LINUX.md) — WebKitGTK, Tesseract, xdg-desktop-portal.

```bash
npm install
npm run desktop:dev       # dev with hot reload
npm run desktop:package   # Windows NSIS or Linux deb/AppImage
```

| Default hotkey | Action |
|----------------|--------|
| `Ctrl+Shift+Space` | Toolbar for selected text (clipboard fallback) |
| `Ctrl+Shift+O` | OCR toolbar — region pick → popup actions (games, images) |
| `Ctrl+Shift+X` | OCR chat — region pick → workspace chat |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+Shift+L` | **Live game translate** — OCR overlay for games (v0.2) |
| `Ctrl+Shift+Left` / `Right` | Cycle saved live-translate regions |

All hotkeys are configurable in **Settings → Keyboard shortcuts**.

### Live game translate (v0.2)

Real-time subtitle/UI translation overlay for games (borderless windowed recommended):

1. **Settings → Live game translate** — engine, languages, **Continuous** on/off  
   (also: system tray **Toggle Continuous Live Translate**, or the overlay pill)
2. `Ctrl+Shift+L` → full-screen scan (or pick a region in settings)
3. Translated boxes paint on top of the game; Esc / hotkey again to stop

| Engine | Key required |
|--------|----------------|
| Google / Bing (free) | No — fine for on-demand; Continuous prefers Offline NMT |
| Lingva proxy | No |
| LibreTranslate (localhost) | No — run server yourself |
| Offline Argos NMT | No — download ~100 MB model (best for Continuous) |
| AI provider | Yes — optional |

**Linux Continuous** needs `gst-plugin-pipewire` (PipeWire ScreenCast). Prefer **source language = game language** (e.g. English OCR for English games) — do not point Live at a Russian desktop UI with English OCR.

Docs: [`docs/DESKTOP_LIVE_TRANSLATE.md`](docs/DESKTOP_LIVE_TRANSLATE.md) · Linux: [`docs/DESKTOP_LINUX.md`](docs/DESKTOP_LINUX.md) · offline sidecar: [`apps/desktop/sidecar/README.md`](apps/desktop/sidecar/README.md)

**Desktop v0.2.x** — live translate + Continuous + Linux capture · **Extension v0.1.0** unchanged.

Docs: [`DESKTOP_PORTING_PLAN.md`](docs/DESKTOP_PORTING_PLAN.md) · [`DESKTOP_RELEASE.md`](docs/DESKTOP_RELEASE.md) (smoke test) · [`DESKTOP_TOOLBAR.md`](docs/DESKTOP_TOOLBAR.md)

---

## Chrome Web Store

Store listing copy and packaging notes: [`docs/STORE.md`](docs/STORE.md)
