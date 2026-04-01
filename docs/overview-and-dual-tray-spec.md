# Overview And Dual Tray Spec

## Goal

Add a default `Overview` panel that shows Claude Code and Codex at the same time, and upgrade the tray to present both quota sources in a single tray item.

## Why

The current app requires tab switching to compare Claude Code and Codex. The new default should support a quick "one glance" workflow from the tray click.

## UX

- Add a third top-level tab: `Overview`
- Open the window into `Overview` by default
- Keep existing `Claude` and `Codex` tabs for detailed inspection
- `Overview` shows two compact summary cards:
  - Claude Code card
  - Codex card
- Each card includes:
  - connection state
  - primary used percent
  - reset timing
  - 2-3 secondary metrics
  - dashboard button
- If one source is disconnected, its card shows an inline empty/error state without blocking the other card

## Tray

- Use one tray item only
- Tray icon becomes a dual-ring progress icon
  - outer ring: Claude Code
  - inner ring: Codex
- Tray title shows compact paired values:
  - `68/54`
  - `--/54`
  - `68/--`
  - `--`
- Tooltip shows both services on separate lines with last updated time
- Right-click menu remains safe and compact
  - status lines for Claude Code and Codex
  - open overview
  - refresh all
  - open Claude dashboard
  - open Codex dashboard
  - quit

## Data Rules

- Claude primary percent:
  - `weeklyTotal`
  - else max of `weeklyOpus` and `weeklySonnet`
  - else `session`
- Codex primary percent:
  - `secondary`
  - else `primary`
- Missing/disconnected data must render as unavailable, not fake values

## Files Expected To Change

- `src/App.tsx`
- `src/components/TabSwitcher.tsx`
- `src/components/OverviewPanel.tsx`
- `src/services/backend.ts`
- `src/styles.css`
- `src-tauri/src/commands.rs`
- `src-tauri/src/domain/models.rs`
- `src-tauri/src/services/tray.rs`
- `src-tauri/src/services/tray_icon.rs`

## Validation

- `bun run build`
- `cd src-tauri && cargo check`
- run local dev app and verify tray icon/title plus Overview panel
