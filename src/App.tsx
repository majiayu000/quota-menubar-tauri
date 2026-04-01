import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import ActionButtons from './components/ActionButtons';
import CodexPanel from './components/CodexPanel';
import OverviewPanel from './components/OverviewPanel';
import QuotaCard from './components/QuotaCard';
import TabSwitcher, { TabName } from './components/TabSwitcher';
import ThemeSelector, { ThemeName } from './components/ThemeSelector';
import { backend } from './services/backend';
import type { CodexRateLimits, CodexSnapshot, QuotaData } from './types/models';
import './styles.css';

const THEME_STORAGE_KEY = 'claude-quota-theme';
const DOCK_HIDDEN_KEY = 'claude-quota-dock-hidden';
const TAB_STORAGE_KEY = 'claude-quota-tab';
const AUTO_REFRESH_INTERVAL_MS = 60 * 1000;
const BACKOFF_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const TRAY_SHOW_OVERVIEW_EVENT = 'tray://show-overview';
const TRAY_REFRESH_ALL_EVENT = 'tray://refresh-all';

const EMPTY_CODEX_SNAPSHOT: CodexSnapshot = {
  info: null,
  stats: null,
  rateLimits: null,
  loading: true,
  error: null,
};

function isMacOSPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? '';
  return /mac/i.test(platform);
}

function getSavedTab(): TabName {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === 'overview' || saved === 'claude' || saved === 'codex') {
      return saved;
    }
  } catch {}
  return 'overview';
}

function getSavedTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (
      saved &&
      ['light', 'dark', 'claude', 'claude-dark', 'minimal', 'minimal-dark', 'ocean'].includes(saved)
    ) {
      return saved as ThemeName;
    }
  } catch {}
  return 'light';
}

function getSavedDockHidden(): boolean {
  try {
    return localStorage.getItem(DOCK_HIDDEN_KEY) === 'true';
  } catch {}
  return false;
}

function formatResetTime(resetTime?: string): string {
  if (!resetTime) return 'N/A';
  try {
    const reset = new Date(resetTime);
    const diff = reset.getTime() - Date.now();
    if (diff <= 0) return 'Soon';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  } catch {
    return 'N/A';
  }
}

function getClaudeTrayUsedPercent(quota: QuotaData | null): number | null {
  if (!quota) return null;
  if (quota.weeklyTotal) return quota.weeklyTotal.percentage;

  const weeklyUsedCandidates = [quota.weeklyOpus?.percentage, quota.weeklySonnet?.percentage]
    .filter((value): value is number => typeof value === 'number');
  if (weeklyUsedCandidates.length > 0) {
    return Math.max(...weeklyUsedCandidates);
  }
  return quota.session?.percentage ?? null;
}

function getCodexTrayUsedPercent(limits: CodexRateLimits | null): number | null {
  if (!limits) return null;
  if (limits.secondary?.usedPercent != null) {
    return limits.secondary.usedPercent;
  }
  if (limits.primary?.usedPercent != null) {
    return limits.primary.usedPercent;
  }
  return null;
}

function getCodexConnected(snapshot: CodexSnapshot): boolean {
  return Boolean(snapshot.rateLimits?.connected) || Boolean(snapshot.info?.connected);
}

export default function App() {
  const isMacOS = isMacOSPlatform();

  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const claudeIntervalRef = useRef(AUTO_REFRESH_INTERVAL_MS);

  const [codexSnapshot, setCodexSnapshot] = useState<CodexSnapshot>(EMPTY_CODEX_SNAPSHOT);
  const [codexManualRefreshNonce, setCodexManualRefreshNonce] = useState(0);

  const [theme, setTheme] = useState<ThemeName>(getSavedTheme);
  const [dockHidden, setDockHidden] = useState<boolean>(getSavedDockHidden);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>(getSavedTab);
  const containerRef = useRef<HTMLDivElement>(null);

  const codexConnected = getCodexConnected(codexSnapshot);
  const codexLoading = codexSnapshot.loading;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    const updateHeight = async () => {
      if (!containerRef.current) return;
      const height = containerRef.current.scrollHeight + 24;
      try {
        await backend.resizeWindow(Math.min(Math.max(height, 300), 680));
      } catch {
        showToast('Failed to resize window');
      }
    };

    const timer1 = setTimeout(updateHeight, 50);
    const timer2 = setTimeout(updateHeight, 300);
    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      observer.disconnect();
    };
  }, [activeTab, quota, codexSnapshot, codexConnected, showToast]);

  const fetchClaudeQuota = useCallback(async () => {
    try {
      setClaudeLoading(true);
      setClaudeError(null);
      const data = await backend.getQuota();

      if (data.error) {
        setClaudeError(data.error);
        if (!data.error.includes('429')) {
          setQuota(null);
        }
        if (data.error.includes('429')) {
          claudeIntervalRef.current = BACKOFF_REFRESH_INTERVAL_MS;
        }
      } else {
        setQuota(data);
        setClaudeError(null);
        claudeIntervalRef.current = AUTO_REFRESH_INTERVAL_MS;
      }
    } catch (err) {
      setClaudeError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setClaudeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaudeQuota();
  }, [fetchClaudeQuota]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        fetchClaudeQuota().then(schedule);
      }, claudeIntervalRef.current);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [fetchClaudeQuota]);

  useEffect(() => {
    backend
      .updateTrayIcon({
        claudeConnected: quota?.connected ?? false,
        claudePercentage: getClaudeTrayUsedPercent(quota),
        codexConnected,
        codexPercentage: getCodexTrayUsedPercent(codexSnapshot.rateLimits),
      })
      .catch(() => {
        showToast('Failed to update tray');
      });
  }, [quota, codexConnected, codexSnapshot.rateLimits, showToast]);

  useEffect(() => {
    let stopShowOverview: (() => void) | undefined;
    let stopRefreshAll: (() => void) | undefined;

    const bindTrayEvents = async () => {
      stopShowOverview = await listen(TRAY_SHOW_OVERVIEW_EVENT, () => {
        setActiveTab('overview');
      });

      stopRefreshAll = await listen(TRAY_REFRESH_ALL_EVENT, () => {
        fetchClaudeQuota();
        setCodexManualRefreshNonce((value) => value + 1);
      });
    };

    void bindTrayEvents();
    return () => {
      stopShowOverview?.();
      stopRefreshAll?.();
    };
  }, [fetchClaudeQuota]);

  const handleThemeChange = useCallback((newTheme: ThemeName) => {
    setTheme(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
  }, []);

  useEffect(() => {
    backend.setDockVisibility(!dockHidden).catch(() => {
      showToast('Failed to apply dock visibility');
    });
  }, [dockHidden, showToast]);

  const handleDockToggle = useCallback(() => {
    setDockHidden((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem(DOCK_HIDDEN_KEY, String(newValue));
      } catch {}
      return newValue;
    });
  }, []);

  const handleTabChange = useCallback((tab: TabName) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {}
  }, []);

  const refreshCodex = useCallback(() => {
    setCodexManualRefreshNonce((value) => value + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'overview') {
      fetchClaudeQuota();
      refreshCodex();
      return;
    }
    if (activeTab === 'claude') {
      fetchClaudeQuota();
      return;
    }
    refreshCodex();
  }, [activeTab, fetchClaudeQuota, refreshCodex]);

  const openBothDashboards = useCallback(async () => {
    const results = await Promise.allSettled([
      backend.openClaudeDashboard(),
      backend.openCodexDashboard(),
    ]);

    if (results.some((result) => result.status === 'rejected')) {
      showToast('Failed to open one or more dashboards');
    }
  }, [showToast]);

  const handleOpenDashboard = useCallback(async () => {
    try {
      if (activeTab === 'overview') {
        await openBothDashboards();
        return;
      }
      if (activeTab === 'claude') {
        await backend.openClaudeDashboard();
      } else {
        await backend.openCodexDashboard();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open dashboard';
      showToast(message);
    }
  }, [activeTab, openBothDashboards, showToast]);

  const handleQuit = async () => {
    try {
      await backend.quitApp();
    } catch {
      showToast('Failed to quit app');
    }
  };

  return (
    <div className={`app theme-${theme}`}>
      {toast && <div className="toast">{toast}</div>}
      <div className="container" ref={containerRef}>
        <TabSwitcher
          activeTab={activeTab}
          onTabChange={handleTabChange}
          claudeConnected={quota?.connected ?? false}
          codexConnected={codexConnected}
        />

        <div className="settings-row">
          <div className="settings-meta">
            <span className="settings-title">Appearance</span>
            {isMacOS && (
              <label className="dock-toggle">
                <span className="toggle-label">Hide Dock</span>
                <input type="checkbox" checked={dockHidden} onChange={handleDockToggle} />
              </label>
            )}
          </div>
          <ThemeSelector currentTheme={theme} onThemeChange={handleThemeChange} />
        </div>

        {activeTab === 'overview' && (
          <OverviewPanel
            claudeQuota={quota}
            claudeLoading={claudeLoading}
            claudeError={claudeError}
            codexSnapshot={codexSnapshot}
            onOpenClaudeDashboard={() => {
              backend.openClaudeDashboard().catch(() => {
                showToast('Failed to open Claude dashboard');
              });
            }}
            onOpenCodexDashboard={() => {
              backend.openCodexDashboard().catch(() => {
                showToast('Failed to open Codex dashboard');
              });
            }}
          />
        )}

        {activeTab === 'claude' && (
          <>
            {claudeLoading && !quota && (
              <div className="loading-state">Loading Claude quota...</div>
            )}

            {claudeError && (
              <div className="error-banner">
                <span className="error-icon">!</span>
                <span className="error-text">{claudeError}</span>
              </div>
            )}

            {!claudeError && quota && (
              <div className="quota-list">
                <div className="section">
                  <div className="section-title">CURRENT SESSION</div>
                  {quota.session ? (
                    <QuotaCard
                      label="5-Hour Usage"
                      percentage={Math.round(quota.session.percentage)}
                      resetsIn={formatResetTime(quota.session.resetTime)}
                    />
                  ) : (
                    <div className="no-data">No session data</div>
                  )}
                </div>

                <div className="section">
                  <div className="section-title">WEEKLY LIMITS</div>
                  {quota.weeklyTotal && (
                    <QuotaCard
                      label="7-Day Usage"
                      percentage={Math.round(quota.weeklyTotal.percentage)}
                      resetsIn={formatResetTime(quota.weeklyTotal.resetTime)}
                    />
                  )}

                  {quota.weeklyOpus && (
                    <QuotaCard
                      label="Opus (7-Day)"
                      percentage={Math.round(quota.weeklyOpus.percentage)}
                      resetsIn={formatResetTime(quota.weeklyOpus.resetTime)}
                    />
                  )}

                  {quota.weeklySonnet && (
                    <QuotaCard
                      label="Sonnet (7-Day)"
                      percentage={Math.round(quota.weeklySonnet.percentage)}
                      resetsIn={formatResetTime(quota.weeklySonnet.resetTime)}
                    />
                  )}

                  {!quota.weeklyTotal && !quota.weeklyOpus && !quota.weeklySonnet && (
                    <div className="no-data">No weekly data</div>
                  )}
                </div>
              </div>
            )}

            {!claudeError && !quota && !claudeLoading && (
              <div className="empty-state">
                <p>Unable to load quota data</p>
                <button onClick={handleRefresh} className="retry-btn">
                  Try Again
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ display: activeTab === 'codex' ? 'block' : 'none' }}>
          <CodexPanel
            manualRefreshNonce={codexManualRefreshNonce}
            autoRefreshIntervalMs={AUTO_REFRESH_INTERVAL_MS}
            onSnapshotChange={setCodexSnapshot}
          />
        </div>

        <ActionButtons
          onRefresh={handleRefresh}
          onDashboard={handleOpenDashboard}
          onQuit={handleQuit}
          loading={
            activeTab === 'overview'
              ? claudeLoading || codexLoading
              : activeTab === 'claude'
                ? claudeLoading
                : codexLoading
          }
          dashboardLabel={activeTab === 'overview' ? 'Dashboards' : 'Dashboard'}
        />
      </div>
    </div>
  );
}
