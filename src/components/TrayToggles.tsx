import type { TrayServiceName } from '../services/tray_visibility';

interface TrayTogglesProps {
  claudeEnabled: boolean;
  codexEnabled: boolean;
  claudeConnected: boolean;
  codexConnected: boolean;
  onToggle: (service: TrayServiceName) => void;
}

function renderToggle(
  service: TrayServiceName,
  label: string,
  enabled: boolean,
  connected: boolean,
  onToggle: (service: TrayServiceName) => void,
) {
  return (
    <div className="dock-toggle tray-toggle" key={service}>
      <span className="tray-toggle-copy">
        <span className="toggle-label">{label}</span>
        <span className={`tray-toggle-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Placeholder until login'}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        className={`tray-toggle-button ${enabled ? 'checked' : ''}`}
        aria-checked={enabled}
        aria-label={`${label} toggle`}
        onClick={() => onToggle(service)}
      >
        <span className="tray-toggle-thumb" />
      </button>
    </div>
  );
}

export default function TrayToggles({
  claudeEnabled,
  codexEnabled,
  claudeConnected,
  codexConnected,
  onToggle,
}: TrayTogglesProps) {
  return (
    <div className="tray-settings">
      <div className="settings-title">Tray</div>
      <div className="tray-toggle-list">
        {renderToggle('claude', 'Claude Tray', claudeEnabled, claudeConnected, onToggle)}
        {renderToggle('codex', 'Codex Tray', codexEnabled, codexConnected, onToggle)}
      </div>
    </div>
  );
}
