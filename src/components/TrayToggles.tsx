import type { TrayServiceName } from '../services/tray_visibility';

interface TrayTogglesProps {
  claudeEnabled: boolean;
  codexEnabled: boolean;
  claudeCanDisable: boolean;
  codexCanDisable: boolean;
  claudeConnected: boolean;
  codexConnected: boolean;
  onToggle: (service: TrayServiceName) => void;
}

function renderToggle(
  service: TrayServiceName,
  label: string,
  enabled: boolean,
  canDisable: boolean,
  connected: boolean,
  onToggle: (service: TrayServiceName) => void,
) {
  const disableToggle = enabled && !canDisable;
  return (
    <div className="dock-toggle tray-toggle" key={service}>
      <span className="tray-toggle-copy">
        <span className="toggle-label">{label}</span>
        <span className={`tray-toggle-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Requires Codex App or CLI login'}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        className={`tray-toggle-button ${enabled ? 'checked' : ''} ${disableToggle ? 'disabled' : ''}`}
        aria-checked={enabled}
        aria-disabled={disableToggle}
        aria-label={`${label} toggle`}
        disabled={disableToggle}
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
  claudeCanDisable,
  codexCanDisable,
  claudeConnected,
  codexConnected,
  onToggle,
}: TrayTogglesProps) {
  return (
    <div className="tray-settings">
      <div className="settings-title">Tray</div>
      <div className="tray-toggle-list">
        {renderToggle('claude', 'Claude Tray', claudeEnabled, claudeCanDisable, claudeConnected, onToggle)}
        {renderToggle('codex', 'Codex Tray', codexEnabled, codexCanDisable, codexConnected, onToggle)}
      </div>
    </div>
  );
}
