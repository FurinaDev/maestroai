# MaestroAI — JARVIS Voice Assistant & Automation Core

A modern, high-performance React & TypeScript rewrite of **MaestroAI JARVIS** — cross-platform personal AI orchestrator for macOS, Windows, and Web.

## Key Features

- **Holographic HUD Canvas**: Concentric glowing teal rings, rotating segmented arcs, 160-particle 3D squashed vortex, 84 shell particles, pulsing halo rings, and state-driven color switching.
- **Direct Autoplay (In-HUD Media Player)**: Zero-friction music & video playback. Plays requested songs directly inside the HUD without requiring manual clicking or browser tab switching.
- **Continuous Learning & Memory Core**: Automatically extracts and registers user habits, music preferences, rules, and routines with confidence scoring.
- **Google Workspace & Communication**:
  - Live email composer & sender (Gmail / macOS / Windows mail)
  - Google Docs creation and live note sync
  - Google Sheets table row appender and summary
- **Real-Time Speech Interaction**: Continuous Turkish (`tr-TR`) and English speech recognition with text-to-speech voice responses and configurable voice personalities (`Charon`, `Puck`, `Aoede`, `Kore`, `Fenrir`, `Leda`, `Orus`, `Zephyr`).
- **Full macOS / Windows Toolkit**:
  - `open_app`: Fast application launcher
  - `sys_info`: Real-time CPU, RAM, Disk, MagSafe/Battery, Network I/O
  - `get_weather`: Live city weather via wttr.in
  - `calendar` & `reminders`: Interactive agenda and task management
  - `analyze_screen`: Active window visual inspection
  - `shell_run`: Terminal sandbox runner
  - `whatsapp`: Message dispatching with phonebook lookup
- **Audio & SFX**: Authentic HUD ambient sound loop, startup, think, done, and error sound effects with volume control and Web Audio synthesis fallback.

## Running Locally

```bash
npm install
npm run dev
```

App listens on `http://0.0.0.0:3000`.
