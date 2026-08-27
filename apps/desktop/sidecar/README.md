# SelectMind Argos sidecar

Minimal HTTP server wrapping `argostranslate` for offline live translate.

## Dev (Python)

```powershell
cd apps/desktop/sidecar
python -m pip install -r requirements.txt
$env:SELECTMIND_MODELS_DIR = "$env:APPDATA\SelectMind\models"
python argos_server.py
```

Download a model in **Settings → Live game translate → Offline models** first.

## Bundled binary (release)

Build a standalone executable with PyInstaller:

```powershell
cd apps/desktop/sidecar
python -m pip install -r requirements.txt pyinstaller
pyinstaller --onefile --name selectmind-argos argos_server.py
Copy-Item dist/selectmind-argos.exe ../src-tauri/binaries/selectmind-argos-x86_64-pc-windows-msvc.exe
```

Then add to `apps/desktop/src-tauri/tauri.conf.json`:

```json
"externalBin": ["binaries/selectmind-argos"]
```

Tauri bundles `externalBin` next to the main app. When the binary is missing, the desktop app falls back to `python argos_server.py` during development.

## HTTP API

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/health` | — | `{ ok, pairs[] }` |
| POST | `/translate` | `{ q, source, target }` | `{ translatedText }` |
| POST | `/translate` | `{ q: string[], source, target }` | `{ translations[] }` |

Environment variables:

- `SELECTMIND_MODELS_DIR` — downloaded `*.argosmodel` files (required)
- `SELECTMIND_ARGOS_PORT` — default `18765`
- `SELECTMIND_ARGOS_HOST` — default `127.0.0.1`
