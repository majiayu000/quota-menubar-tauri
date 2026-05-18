export type TrayServiceName = 'claude' | 'codex' | 'cursor' | 'antigravity';

const TRAY_STORAGE_KEYS: Record<TrayServiceName, string> = {
  claude: 'claude-tray-enabled',
  codex: 'codex-tray-enabled',
  cursor: 'cursor-tray-enabled',
  antigravity: 'antigravity-tray-enabled',
};

const TRAY_DEFAULT_ENABLED: Record<TrayServiceName, boolean> = {
  claude: true,
  codex: true,
  cursor: true,
  antigravity: false,
};

export function getSavedTrayEnabled(service: TrayServiceName): boolean {
  try {
    const saved = localStorage.getItem(TRAY_STORAGE_KEYS[service]);
    if (saved === 'false') return false;
    if (saved === 'true') return true;
  } catch {}
  return TRAY_DEFAULT_ENABLED[service];
}

export function saveTrayEnabled(service: TrayServiceName, enabled: boolean): void {
  try {
    localStorage.setItem(TRAY_STORAGE_KEYS[service], String(enabled));
  } catch {}
}

export function shouldShowTray(enabled: boolean, _connected: boolean): boolean {
  return enabled;
}
