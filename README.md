# SelectMind AI

AI assistant for any webpage — select text, explain, translate, and continue the chat in place.

## Stack

- TypeScript, Manifest V3, React, Vite, Tailwind, shadcn/ui
- Zustand, React Query, Framer Motion, Dexie
- Vitest, Playwright, ESLint, Prettier

## Development

```bash
npm install
node scripts/generate-icons.mjs
npm run dev
```

Load the extension from the `dist` folder in `chrome://extensions` (Developer mode).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development build with HMR |
| `npm run build` | Production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | E2E tests (Playwright, requires `npm run build` first) |

## Architecture

```
UI → Use Cases → Domain → Ports → Adapters
```

See the architecture document in project chat for full design.

## Current Phase

**Phase 0 — Foundation** ✅

**Phase 1 — Core Loop** ✅

- AI Router with provider registry
- Providers: OpenAI, Anthropic, Gemini, Ollama
- SSE streaming pipeline (background → content script / side panel)
- Quick Action popup with live markdown rendering
- Provider management in Options (API key, test connection)
- Encrypted API key storage (Web Crypto AES-GCM)

**Phase 2 — Chat & Workspace** ✅

- Shared ChatView component (Side Panel + Content Script)
- ContextChips: selection, page title, custom fragments
- «Add current selection» via context:get relay
- ChatPopup for chat-mode actions
- Conversation list in Workspace
- conversation:promote (quick → chat)
- Paginated message history + load more
- Auto-scroll to latest message

**Phase 3 — Actions & Settings** ✅

- Action Editor (create / edit / delete custom actions)
- 30 built-in actions across 7 categories
- Custom categories CRUD
- Toolbar customizer (reorder, add/remove, preview)
- General settings (default provider/model, theme, behavior)
- Tabbed Options page
- Template variable picker in action editor

**Phase 4 — Power Features** ✅

- Command Palette (Ctrl+Shift+P) with fuzzy search
- Per-action hotkeys (content script keydown)
- Pipeline engine (sequential multi-step AI)
- Built-in pipelines: Language Learning, Code Review
- Import/Export JSON backup
- Pipelines & Backup tabs in Settings

**Phase 5 — Polish & Launch** ✅

- Markdown: syntax highlighting (highlight.js), code copy buttons, KaTeX math
- Error UX with actionable hints (missing key, rate limit, auth)
- Onboarding wizard on first install (provider setup)
- Light/dark/system theme support
- Conversation retention cleanup (daily alarm)
- Playwright E2E smoke tests
- Chrome Web Store listing guide (`docs/STORE.md`)
