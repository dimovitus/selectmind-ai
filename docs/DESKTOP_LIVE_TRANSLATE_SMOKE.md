# Live translate — manual smoke checklist

Automated desktop E2E is not wired yet (Tauri multi-window + screen capture). Use this checklist after installer or dev builds.

**Prerequisite:** exit the tray app before installing a new build, or the exe may stay stale.

## Quick path (on-demand, default)

| # | Step | Pass |
|---|------|:----:|
| 1 | Open a windowed app or game with on-screen English text | ☐ |
| 2 | Press `Ctrl+Shift+L` once — **no region picker**; overlay appears with translated boxes | ☐ |
| 3 | Status pill shows OCR language, line count, engine (e.g. `en · 3 lines · Bing`) | ☐ |
| 4 | Press `Ctrl+Shift+L` again — overlay clears | ☐ |
| 5 | OCR toolbar (`Ctrl+Shift+O`) still works independently | ☐ |

## Continuous mode

| # | Step | Pass |
|---|------|:----:|
| 6 | Settings → Live game translate → **Continuous** | ☐ |
| 7 | Optional: scan focus **Dialogue band** or **Top band** | ☐ |
| 8 | Press hotkey — overlay keeps updating until second press | ☐ |
| 9 | Switch back to **On demand** when done | ☐ |

## Regions (optional)

| # | Step | Pass |
|---|------|:----:|
| 10 | **Pick new region** → draw subtitle strip | ☐ |
| 11 | `Ctrl+Shift+Right` / `Ctrl+Shift+Left` cycle saved regions | ☐ |
| 12 | Hotkey still uses **full screen** unless you explicitly picked a region workflow | ☐ |

## Engines

| # | Step | Pass |
|---|------|:----:|
| 13 | Default **Bing free** or **Google free** works without API key | ☐ |
| 14 | **Offline NMT:** download model → Test offline engine → badge shows Offline | ☐ |
| 15 | **Auto-fallback:** break primary engine → overlay shows source text or fallback engine | ☐ |
| 16 | **Clear translation cache** → count resets in Settings | ☐ |

## Diagnostics (local only)

| # | Step | Pass |
|---|------|:----:|
| 17 | Run live translate for a few ticks | ☐ |
| 18 | Settings → **Copy diagnostics** → paste shows tick history (no network) | ☐ |
| 19 | **Clear diagnostics log** resets counter | ☐ |

## Failure modes to note (not necessarily bugs)

- Exclusive fullscreen may hide overlay — use borderless windowed.
- Anti-cheat may block capture — single-player only.
- Blank overlay status `Capture is blank` — capture exclusion failed; app falls back automatically.
- Rate limit — boxes show **source text**, status warns.

See [DESKTOP_LIVE_TRANSLATE.md](./DESKTOP_LIVE_TRANSLATE.md) for architecture and engine setup.
