# SelectMind Desktop — план портирования

> Статус: **Фазы 0–5.1 завершены** ✅ · **Фаза 6** (release) — **в работе** 🟡

## Цель

Windows-приложение поверх игр и программ: **выделил текст → floating toolbar → AI**, плюс OCR для экрана/игр.
Максимальное переиспользование кода расширения через `@selectmind/core` + `@selectmind/shared`.

## Фазы

| Фаза | Содержание | Статус |
|------|------------|--------|
| **0** | Monorepo, порты, extension adapters, DI | ✅ |
| **1** | Tauri skeleton + UI + storage | ✅ |
| **2** | OS capture + OCR (xcap + Windows OCR + Tesseract) | ✅ |
| **3** | Global hotkeys + region picker + chat routing | ✅ |
| **4** | Overlay / tray / keychain / autostart | ✅ |
| **5** | Паритет функций с extension | ✅ |
| **5.1** | Selection overlay (toolbar + popup) | ✅ |
| **6** | Установщик, подпись, auto-updates | 🟡 |

---

## Фаза 5 / 5.1 — Паритет с extension ✅

| Функция | Desktop |
|---------|---------|
| Chat + streaming + follow-up | ✅ |
| Provider / actions / pipelines / backup | ✅ |
| Command palette | ✅ (настраиваемый hotkey, default `Ctrl+Shift+P`) |
| Onboarding | ✅ |
| Floating toolbar (auto on selection) | ✅ UIA + Win32 fallback |
| Toolbar anywhere (clipboard) | ✅ default `Ctrl+Shift+Space` |
| OCR chat (region → workspace chat) | ✅ default `Ctrl+Shift+X` |
| OCR toolbar (region → popup actions) | ✅ default `Ctrl+Shift+O` |
| Chat popup (drag, resize, expand) | ✅ `selection-overlay` + `ChatView` |
| Toolbar customizer | ✅ Settings → Toolbar |
| Custom hotkeys | ✅ Settings → Keyboard shortcuts |

**Архитектура overlay:** одно окно `selection-overlay` (toolbar + popup), Rust-модуль `src-tauri/src/selection/`.

Подробнее: [DESKTOP_TOOLBAR.md](./DESKTOP_TOOLBAR.md)

### Глобальные hotkeys (defaults)

| Hotkey | Действие |
|--------|----------|
| `Ctrl+Shift+Space` | Toolbar для выделенного текста (Ctrl+C fallback) |
| `Ctrl+Shift+O` | OCR toolbar (игры, картинки) |
| `Ctrl+Shift+X` | OCR chat (регион → чат) |
| `Ctrl+Shift+P` | Command palette |

Все комбинации настраиваются в **Settings → Keyboard shortcuts**.

---

## Фаза 6 — Release 🟡

| Задача | Статус |
|--------|--------|
| NSIS + `npm run desktop:package` | ✅ unsigned installer собирается |
| Smoke checklist | ✅ [DESKTOP_RELEASE.md](./DESKTOP_RELEASE.md) |
| Code signing (SmartScreen) | ⬜ нужен OV/EV сертификат |
| Tauri updater | ⬜ после подписи + hosting |

### Post-audit fixes (Jul 2026)

| Fix | Описание |
|-----|----------|
| Hidden console | `#![windows_subsystem = "windows"]` в release |
| OCR toolbar deadlock | `show_toolbar_for_snapshot` → background thread |
| Provider registry in overlay | sync registry перед AI-вызовами |
| OCR toolbar ghost-click | 450 ms grace перед кликами по toolbar |
| Gaming FPS | UIA skip только для game window classes + adaptive poll |
| Auto-toolbar regression | убран fullscreen-heuristic (95% экрана) |

### Следующие шаги

1. Прогнать smoke test из [DESKTOP_RELEASE.md](./DESKTOP_RELEASE.md)
2. `npm run desktop:package` → тест установщика на чистой VM
3. Подписать `.exe` (production)
4. GitHub Release + updater endpoint

---

## Запуск

```bash
npm run desktop:dev
```

## Известные ограничения

- **Exclusive fullscreen** — overlay может не работать; OCR toolbar hotkey — да ([DESKTOP_CAPTURE.md](./DESKTOP_CAPTURE.md))
- **Контекстное меню Windows** — нельзя без DLL-injection; используйте hotkeys
- **Settings** — conversations в SQLite; preferences/hotkeys пока в localStorage
- **Gaming FPS** — auto-toolbar polls foreground; отключите в Settings или используйте hotkeys ([DESKTOP_CAPTURE.md](./DESKTOP_CAPTURE.md))

Подробнее: [DESKTOP_ADAPTER_CONTRACT.md](./DESKTOP_ADAPTER_CONTRACT.md)
