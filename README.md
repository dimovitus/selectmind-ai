# SelectMind AI

**Turn any webpage into an AI workspace.** Select text, get instant answers, and keep the conversation going — without leaving the page.

SelectMind AI is a Chrome extension (Manifest V3) that puts a floating toolbar on text selection, opens a resizable chat popup, and offers a full side-panel workspace. Connect your own AI provider and work with page context automatically.

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
| Anthropic | Claude 3.5 / 3 |
| Google Gemini | Gemini 1.5 / 2 |
| Ollama | Local models |
| OpenAI-compatible | Any custom base URL |

Configure providers and API keys in **Extension options** after install.

---

## Install (development)

**Requirements:** Node.js 20+, Google Chrome

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

For hot reload during development:

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

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev build with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E smoke tests (Playwright) |
| `npm run lint` | ESLint |

**Stack:** TypeScript, React, Vite, Tailwind, Zustand, React Query, Dexie, Framer Motion.

Architecture follows a hexagonal layout: UI → use cases → domain → ports → adapters.

---

## Chrome Web Store

Store listing copy and packaging notes: [`docs/STORE.md`](docs/STORE.md)
