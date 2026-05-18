import type { CSSProperties } from 'react';
import type { TrayServiceName } from '../services/tray_visibility';
import { SERVICE_META, SERVICES } from '../services/service_meta';

export type TabName = TrayServiceName;

interface TabSwitcherProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  connected: Record<TabName, boolean>;
  loading?: Record<TabName, boolean>;
  usedPercent?: Record<TabName, number | null>;
}

function formatDockMeta(loading: boolean, connected: boolean, usedPercent: number | null): string {
  if (loading) return 'Syncing';
  if (!connected) return 'Offline';
  if (usedPercent == null) return 'Ready';
  return `${Math.round(usedPercent)}% used`;
}

export default function TabSwitcher({
  activeTab,
  onTabChange,
  connected,
  loading,
  usedPercent,
}: TabSwitcherProps) {
  return (
    <div className="provider-grid" aria-label="Providers">
      {SERVICES.map((id) => {
        const meta = SERVICE_META[id];
        const isActive = activeTab === id;
        const isConnected = connected[id];
        const isLoading = loading?.[id] ?? false;
        const pct = usedPercent?.[id] ?? null;
        const style = { '--service-accent': meta.accent } as CSSProperties;

        return (
          <button
            key={id}
            type="button"
            className={`provider-card ${isActive ? 'active' : ''}`}
            style={style}
            aria-current={isActive ? 'page' : undefined}
            title={meta.label}
            onClick={() => onTabChange(id)}
          >
            <span className="provider-card-icon" aria-hidden="true">
              {meta.initials}
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            </span>
            <span className="provider-card-copy">
              <span className="provider-card-label">{meta.label}</span>
              <span className="provider-card-meta">
                {formatDockMeta(isLoading, isConnected, pct)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
