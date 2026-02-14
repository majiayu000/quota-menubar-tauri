# Quota Menubar Tauri

Tauri v2 menubar app for monitoring Claude and Codex quota usage on macOS.

## Core Behavior

- Menubar tray icon is created at startup and stays resident.
- Left click tray icon toggles the quota panel.
- Right click menu provides `Show / Hide Window` and `Quit`.
- Claude and Codex are separated into independent tabs and polling flows.
- Tray percentage now represents **used quota** (not remaining quota).

## Quota Semantics

- Claude tray value:
  - prefers weekly window (`weeklyTotal`)
  - falls back to max of `weeklyOpus` and `weeklySonnet`
  - falls back to current session usage
- Codex tray value:
  - prefers weekly window (`secondary_window.used_percent`)
  - falls back to short window (`primary_window.used_percent`)

## Project Layout

- Frontend:
  - `src/App.tsx`
  - `src/components/*`
  - `src/services/backend.ts` (single Tauri invoke gateway)
  - `src/types/models.ts` (shared frontend contracts)
- Backend (Rust):
  - `src-tauri/src/commands.rs` (thin command boundary)
  - `src-tauri/src/domain/models.rs` (serialized contracts)
  - `src-tauri/src/services/claude.rs`
  - `src-tauri/src/services/codex.rs`
  - `src-tauri/src/services/tray.rs`
  - `src-tauri/src/services/tray_icon.rs`
  - `src-tauri/src/services/window.rs`
  - `src-tauri/src/services/link.rs`

## Requirements

- macOS (menubar target)
- Bun (recommended package manager/runtime)
- Rust toolchain
- Tauri prerequisites installed

## Development

```bash
bun install
bun run tauri dev
```

## Build

```bash
bun run tauri build --bundles app
```

App bundle output:

`src-tauri/target/release/bundle/macos/Quota Menubar Tauri.app`

## Install / Run

```bash
./scripts/stop_app.sh
./scripts/install_app.sh
./scripts/run_app.sh
```

Or one-shot restart after rebuild:

```bash
./scripts/reinstall_and_run.sh
```

## Verification Commands

```bash
bun run build
cd src-tauri && cargo check
cd src-tauri && cargo test
```

## Troubleshooting

- Tray icon flashes then disappears:
  - check menu bar manager hidden area (Ice/Bartender)
  - ensure app is not auto-grouped into hidden extras
- No quota data:
  - Claude: ensure Claude Code login exists in macOS Keychain
  - Codex: ensure `~/.codex/auth.json` is valid and not expired
- Codex token expired:
  - run `codex` login flow again

## License

Private/internal project (update as needed before open-source release).
