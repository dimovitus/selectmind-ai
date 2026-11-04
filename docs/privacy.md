# Privacy Policy — SelectMind AI

**Last updated:** November 4, 2026

SelectMind AI is a **Chrome / Firefox extension** and a **desktop app (Windows / Linux)** for AI-assisted reading, writing, OCR, and (on desktop) live game translation.
**We do not collect your data on our own servers.**

## What stays on your device

### Browser extension
- Settings, custom actions, and pipelines
- Chat history (IndexedDB)
- API keys, encrypted with Web Crypto (AES-GCM) in browser local storage

### Desktop app
- Settings (local storage) and chat history (SQLite)
- API keys in the OS credential store (Windows Credential Manager / Linux Secret Service)
- Optional offline translation models you download (e.g. Argos NMT)

## What leaves your device

### AI actions (extension and desktop)
Only when **you** run an AI action, the client sends a request **directly** to the AI provider you configured (OpenAI, Anthropic, Gemini, Ollama, etc.). That may include selected text, page or window context, OCR text, screenshots you capture, and conversation history for that thread.

### Live game translate (desktop only)
When you use free or proxy translation engines (Google, Bing, Lingva, LibreTranslate, etc.), text recognized from the screen region you chose is sent **directly** to that engine. Offline Argos NMT stays on your machine. AI-provider mode uses your configured provider as above.

Custom OpenAI-compatible base URLs you configure receive the same payload as any other provider you choose.

## What we do not do

- No analytics or advertising
- No SelectMind AI backend that stores prompts or keys
- No sale of user data

## Encryption note (extension)

API-key encryption protects keys at rest in browser storage. It is bound to the extension installation, not a user passphrase. Anyone with access to your browser profile can potentially recover keys. Prefer the desktop app’s OS keyring when you need stronger OS-level protection.

## Donations

Optional Privat24 donation links open outside the app. Payment data is not processed by SelectMind AI.

## Contact

[GitHub Issues](https://github.com/Dimovitus/selectmind-ai/issues)

Full policy (HTML): [privacy.html](./privacy.html)
