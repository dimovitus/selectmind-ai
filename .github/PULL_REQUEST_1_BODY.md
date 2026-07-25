## Summary

Monorepo refactor + **Windows desktop app** (Tauri 2) sharing the same AI core as the Chrome extension.

- Extract `@selectmind/core` and `@selectmind/shared`; wire extension through platform adapters
- Desktop: selection overlay (auto toolbar + popup), OCR toolbar/chat, system tray, SQLite, global hotkeys, NSIS packaging
- Extension: screen capture flow, i18n actions, streaming fixes
- Docs: porting plan, toolbar, capture, release smoke checklist

## Phase status

| Phase | Status |
|-------|--------|
| 0 — Monorepo + ports + DI | ✅ |
| 1 — Tauri skeleton + UI + storage | ✅ |
| 2 — OS capture + OCR | ✅ |
| 3 — Hotkeys + region picker | ✅ |
| 4 — Overlay / tray / keychain / autostart | ✅ |
| 5 / 5.1 — Feature parity + selection overlay | ✅ |
| 6 — Release (signing, updater) | 🟡 unsigned NSIS builds OK |

## Post-audit fixes (Jul 2026)

| Fix | Detail |
|-----|--------|
| Hidden console | `#![windows_subsystem = "windows"]` in release |
| OCR toolbar deadlock | `show_toolbar_for_snapshot` on background thread |
| Provider registry in overlay | sync registry before AI calls |
| OCR ghost-click | 450 ms click grace after region pick |
| Gaming FPS | UIA skip for game window classes + adaptive poll |
| Auto-toolbar regression | removed fullscreen 95% heuristic |

## Test plan

- [x] `npm test` — 28 tests
- [x] `npm run desktop:test`
- [ ] Smoke checklist in [`docs/DESKTOP_RELEASE.md`](../docs/DESKTOP_RELEASE.md) on clean VM
- [ ] `npm run desktop:package` → install unsigned NSIS on Windows 10/11

## After merge

1. Code signing (OV/EV) for SmartScreen
2. GitHub Release + Tauri updater endpoint
3. Chrome Web Store update (extension unchanged API surface)
