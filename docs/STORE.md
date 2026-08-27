# Chrome Web Store Listing — SelectMind AI

## Short Description (132 chars max)

Select text, get instant AI answers. Explain, translate, chat in place — powered by OpenAI, Anthropic, Gemini, Ollama, and more.

## Detailed Description

**SelectMind AI** turns any webpage into an AI workspace. Select text and instantly explain, translate, summarize, or continue the conversation — powered by the AI providers you already use.

### Key Features

- **Floating Toolbar** — Select text on any page and instantly run AI actions: explain, translate, summarize, rewrite, and more.
- **30+ Built-in Actions** — Ready-to-use prompts for writing, coding, learning, and research.
- **Three UI Modes** — Quick popup for fast answers, inline chat for follow-ups, and a full side panel workspace.
- **Command Palette** — Press `Ctrl+Shift+P` to search and run any action or pipeline.
- **Context Menu** — Right-click selected text → **SelectMind AI** → run toolbar actions.
- **Custom Actions & Pipelines** — Create your own prompts, chain multi-step workflows, and assign hotkeys.
- **Provider-Agnostic** — Connect cloud APIs or run locally with Ollama. Your API keys are encrypted locally.
- **Context-Aware** — Automatically includes selected text, page title, and URL in every request.
- **Import/Export** — Back up and share your actions, categories, and settings.

### Privacy

- API keys are stored encrypted in your browser using Web Crypto.
- Conversations are stored locally in IndexedDB — nothing is sent to SelectMind AI servers.
- AI requests go directly from your browser to the provider you configure.

### Getting Started

1. Install SelectMind AI
2. Open Settings and add your AI provider + API key
3. Select text on any webpage
4. Click an action in the floating toolbar or press `Ctrl+Shift+P`

## Category

Productivity

## Language

English (primary), with multilingual action support

## Screenshots Needed (1280×800 or 640×400)

1. Floating toolbar on selected text
2. Quick action popup with AI response
3. Side panel workspace with conversation list
4. Command palette (`Ctrl+Shift+P`)
5. Options — Provider setup
6. Options — Action editor

## Promotional Assets

- **Icon:** 128×128 PNG (provided in `assets/icons/`)
- **Small promo tile:** 440×280 PNG
- **Marquee promo tile:** 1400×560 PNG (optional)

## Permissions Justification

| Permission | Reason |
|---|---|
| `storage` | Save settings, API keys (encrypted), conversations locally |
| `activeTab` | Read selected text and page context from the current tab |
| `sidePanel` | Workspace UI in Chrome side panel |
| `contextMenus` | Right-click menu on selected text (SelectMind AI → actions) |
| `alarms` | Periodic cleanup of old conversations per retention setting |
| `<all_urls>` | Inject content script on any page the user visits |

## Privacy Policy URL

Host `docs/privacy.html` on GitHub Pages (see below). Use this URL in the Chrome Web Store:

**https://dimovitus.github.io/selectmind-ai/privacy.html**

**Homepage (Chrome Web Store):** `https://dimovitus.github.io/selectmind-ai/`  
(or `https://github.com/dimovitus/selectmind-ai` if Pages is not deployed yet)

**Support URL:** `https://github.com/dimovitus/selectmind-ai/issues`

Required statements:
- No data collection by SelectMind AI
- API keys and conversations stored locally
- Third-party AI providers receive user prompts per their policies

## Version Notes (0.1.1)

- Fix context menu registration on install (right-click selected text → SelectMind AI)
- Remove unused `clipboardRead` permission

## Version Notes (0.1.0)

Initial release:
- MV3 extension with popup, chat, and side panel modes
- OpenAI, Anthropic, Gemini, Ollama support
- 30 built-in actions, pipelines, command palette
- Import/export, onboarding wizard

## Build & Package for Store

```powershell
cd "C:\Users\Dimovitus\Projects\AI Chrome"
npm install
npm run build
```

Zip the `dist` folder (not the project root):

```powershell
Compress-Archive -Path dist\* -DestinationPath selectmind-ai-v0.1.0.zip
```

Upload `selectmind-ai-v0.1.0.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Pre-Submit Checklist

- [x] Replace placeholder icons with final artwork (`npm run generate:icons`)
- [x] Run `npm run build` with zero TypeScript errors
- [x] Run `npm run test`
- [ ] Run `npm run test:e2e` (optional smoke)
- [ ] Test on fresh Chrome profile (install → onboarding → first action)
- [ ] Publish privacy policy URL → `https://dimovitus.github.io/selectmind-ai/privacy.html`
- [x] Prepare store screenshots → `docs/store-screenshots/` (`npm run capture:screenshots`)
- [x] Package ZIP → `selectmind-ai-v0.1.0.zip` (`npm run package:store`)
- [x] Review permissions in manifest match store justification
