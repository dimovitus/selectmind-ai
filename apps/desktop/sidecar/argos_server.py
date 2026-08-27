#!/usr/bin/env python3
"""SelectMind Argos Translate sidecar — HTTP API compatible with our Rust client."""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

PORT = int(os.environ.get("SELECTMIND_ARGOS_PORT", "18765"))
MODELS_DIR = Path(os.environ.get("SELECTMIND_MODELS_DIR", "")).expanduser()
HOST = os.environ.get("SELECTMIND_ARGOS_HOST", "127.0.0.1")


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def install_downloaded_models() -> None:
    if not MODELS_DIR.is_dir():
        raise RuntimeError(f"Models directory does not exist: {MODELS_DIR}")

    from argostranslate import package

    installed = 0
    for model_file in sorted(MODELS_DIR.glob("*.argosmodel")):
        try:
            package.install_from_path(model_file)
            installed += 1
            log(f"Installed Argos package from {model_file.name}")
        except Exception as error:  # noqa: BLE001 - report and continue
            log(f"WARN: failed to install {model_file.name}: {error}")

    if installed == 0 and not any(MODELS_DIR.glob("*.argosmodel")):
        log(f"WARN: no .argosmodel files found in {MODELS_DIR}")


def translate_text(text: str, source: str, target: str) -> str:
    from argostranslate import translate

    normalized_source = source if source and source != "auto" else "en"
    return translate.translate(text, normalized_source, target)


class ArgosHandler(BaseHTTPRequestHandler):
    server_version = "SelectMindArgosSidecar/0.2"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        parsed = json.loads(raw.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise ValueError("Expected JSON object")
        return parsed

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") in {"/health", "/languages"}:
            pairs: list[dict[str, str]] = []
            try:
                from argostranslate import translate

                for source in translate.get_installed_languages():
                    for translation in source.translations_from:
                        pairs.append(
                            {
                                "source": source.code,
                                "target": translation.to_lang.code,
                            }
                        )
            except Exception as error:  # noqa: BLE001
                log(f"WARN: failed to enumerate installed pairs: {error}")

            self._send_json(200, {"ok": True, "pairs": pairs})
            return

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/translate":
            self._send_json(404, {"error": "not found"})
            return

        try:
            body = self._read_json()
            source = str(body.get("source", "en"))
            target = str(body.get("target", "ru"))
            payload = body.get("q", "")

            if isinstance(payload, list):
                translations = [translate_text(str(item), source, target) for item in payload]
                self._send_json(200, {"translations": translations})
                return

            translated = translate_text(str(payload), source, target)
            self._send_json(200, {"translatedText": translated})
        except Exception as error:  # noqa: BLE001
            self._send_json(500, {"error": str(error)})


def main() -> None:
    try:
        install_downloaded_models()
    except Exception as error:  # noqa: BLE001
        log(f"ERROR: {error}")
        sys.exit(1)

    server = ThreadingHTTPServer((HOST, PORT), ArgosHandler)
    print(f"READY:http://{HOST}:{PORT}", flush=True)
    log(f"Argos sidecar listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
