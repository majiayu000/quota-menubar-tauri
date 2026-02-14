#!/usr/bin/env bash
set -euo pipefail

pkill -f "/Applications/Quota Menubar Tauri.app/Contents/MacOS/quota-menubar-tauri" || true
pkill -f "quota-menubar-tauri/src-tauri/target/release/quota-menubar-tauri" || true

echo "Stopped Quota Menubar Tauri (if running)."
