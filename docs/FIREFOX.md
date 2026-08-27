# Firefox & Zen — SelectMind AI

Zen Browser is Firefox-based, so one WebExtension build covers both.

## What differs from Chrome

| Chrome | Firefox / Zen |
|--------|----------------|
| `side_panel` + `sidePanel` permission | `sidebar_action` (View → Sidebar) |
| Background **service worker** | Background **event page** (`scripts` + `type: module`) |
| `Ctrl+Shift+P` command palette | `Alt+Shift+P` (Firefox already uses Ctrl+Shift+P for a private window) |
| `Ctrl+Shift+S` side panel | `Ctrl+Shift+E` sidebar (or View → Sidebar → SelectMind AI) |
| Chrome Web Store | Sideload now; AMO later |

The UI, actions, providers, OCR capture, and chat are the same codebase.

## Build

```bash
npm install
npm run build:firefox
```

Output: `dist-firefox/`

Package a zip (AMO / Install from file):

```bash
npm run package:firefox
```

Creates `selectmind-ai-firefox-v<version>.zip` in the repo root. You can rename it to `.xpi`.

## Install in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…**
3. Select `dist-firefox/manifest.json`
4. Open **Settings**, add a provider + API key
5. Select text on a page — the floating toolbar should appear

Temporary add-ons are removed when Firefox restarts. For a persistent sideload (unsigned):

- Firefox Developer Edition / Nightly: `about:config` → `xpinstall.signatures.required` = `false`, then `about:addons` → gear → **Install Add-on From File**
- Release Firefox requires a signed AMO build for persistent install

## Install in Zen

1. Open `about:debugging#/runtime/this-firefox` (same as Firefox)
2. **Load Temporary Add-on…** → `dist-firefox/manifest.json`

Or: `about:addons` → gear → **Install Add-on From File** → the `.zip` / `.xpi` (unsigned may be blocked on stable Zen; use temporary load for development).

## Shortcuts (Firefox / Zen)

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+P` | Command palette |
| `Ctrl+Shift+E` | Toggle sidebar |
| `Ctrl+Shift+X` | Screen OCR capture |
| Toolbar icon | Open sidebar |

If a shortcut does not bind, set it in `about:addons` → SelectMind AI → **Manage Extension Shortcuts**.

## Known gaps (this port)

- **OCR / Tesseract** may fail to load language data in the content script; the screenshot still goes to vision-capable models.
- Opening the sidebar from a page action (not a toolbar click) can fail Firefox’s user-gesture rule — click the extension icon or `Ctrl+Shift+E`.
- Not submitted to [addons.mozilla.org](https://addons.mozilla.org) yet.

## AMO checklist (later)

- [ ] Source code disclosure if minified
- [ ] Permission justifications (same as Chrome, minus `sidePanel`)
- [ ] Privacy policy URL
- [ ] Signed with `web-ext sign` / AMO
