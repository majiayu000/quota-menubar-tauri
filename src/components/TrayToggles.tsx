import type { TrayServiceName } from '../services/tray_visibility';

export interface TrayToggleEntry {
  service: TrayServiceName;
  label: string;
  enabled: boolean;
  canDisable: boolean;
  connected: boolean;
  connectedHint?: string;
  disconnectedHint: string;
}

interface TrayTogglesProps {
  entries: TrayToggleEntry[];
  onToggle: (service: TrayServiceName) => void;
}

function renderToggle(entry: TrayToggleEntry, onToggle: (service: TrayServiceName) => void) {
  const disableToggle = entry.enabled && !entry.canDisable;
  const statusText = entry.connected
    ? entry.connectedHint ?? 'Connected'
    : entry.disconnectedHint;
  return (
    <div className="dock-toggle tray-toggle" key={entry.service}>
      <span className="tray-toggle-copy">
        <span className="toggle-label">{entry.label}</span>
        <span className={`tray-toggle-status ${entry.connected ? 'connected' : 'disconnected'}`}>
          {statusText}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        className={`tray-toggle-button ${entry.enabled ? 'checked' : ''} ${disableToggle ? 'disabled' : ''}`}
        aria-checked={entry.enabled}
        aria-disabled={disableToggle}
        aria-label={`${entry.label} toggle`}
        disabled={disableToggle}
        onClick={() => onToggle(entry.service)}
      >
        <span className="tray-toggle-thumb" />
      </button>
    </div>
  );
}

export default function TrayToggles({ entries, onToggle }: TrayTogglesProps) {
  return (
    <div className="tray-settings">
      <div className="settings-title">Tray</div>
      <div className="tray-toggle-list">
        {entries.map((entry) => renderToggle(entry, onToggle))}
      </div>
    </div>
  );
}
