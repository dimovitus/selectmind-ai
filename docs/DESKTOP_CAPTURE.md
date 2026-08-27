# Desktop screen capture — testing & limitations

> Phase 4 deliverable — how SelectMind desktop capture behaves over games and full-screen apps.

## How it works

1. Global hotkey `Ctrl+Shift+X`, workspace **OCR chat**, or tray → **OCR chat**
2. Main window hides; **`capture-overlay`** covers the monitor under the cursor (frozen screenshot preview on Linux)
3. User selects a region; OS capture via **xcap** (Windows) or **xdg-desktop-portal** (Linux)
4. OCR: **Windows.Media.Ocr** or **Tesseract CLI** (Linux) with **Tesseract.js** fallback
5. Result opens in chat (new or current conversation)

> Separate flow: tray / hotkey **OCR toolbar** (`Ctrl+Shift+O`) — same region picker, but opens the floating action toolbar instead of chat.

SelectMind does **not** inject DLLs, hook game processes, or read game memory.

## Manual test checklist

Run `npm run desktop:dev` or the installed build.

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Capture from desktop (Explorer, browser) | Correct region, readable OCR |
| 2 | Second monitor — cursor on monitor 2 | Overlay on monitor 2, capture matches selection |
| 3 | App in tray → hotkey capture | Overlay appears; main window returns after chat |
| 4 | Close window (×) | App stays in tray; hotkey still works |
| 5 | **Launch at startup** enabled → reboot | App starts minimized to tray |
| 6 | Borderless game window | Capture works in most titles |
| 7 | Exclusive fullscreen game | Capture may fail or show black — use borderless |
| 8 | Settings → OCR **Auto** | Native OCR (Windows OCR / Tesseract CLI) when available |
| 9 | Settings → OCR **Tesseract only** | Slower but works offline |

## Known limitations

- **Exclusive fullscreen** — OS may not composite the game frame; prefer borderless windowed.
- **Anti-cheat** — global shortcuts and screen capture APIs may be restricted in competitive games.
- **HDR / unusual color profiles** — colors in capture may differ slightly from on-screen appearance.
- **Linux / Wayland** — capture uses xdg-desktop-portal; see [DESKTOP_LINUX.md](./DESKTOP_LINUX.md).

## Settings reference

| Setting | Location |
|---------|----------|
| Launch at startup | Settings → General → Desktop behavior |
| OCR engine | Settings → General → Desktop behavior |
| Gaming disclaimer | Settings → General → Gaming & screen capture |
| API keys | OS keychain (Windows Credential Manager / Linux Secret Service) |
