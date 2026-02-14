import { useEffect, useState, useCallback, useRef } from 'react';
import QuotaCard from './components/QuotaCard';
import ActionButtons from './components/ActionButtons';
import ThemeSelector, { ThemeName } from './components/ThemeSelector';
import TabSwitcher, { TabName } from './components/TabSwitcher';
import CodexPanel from './components/CodexPanel';
import { backend } from './services/backend';
import type { QuotaData } from './types/models';
import './styles.css';

const THEME_STORAGE_KEY = 'claude-quota-theme';
const DOCK_HIDDEN_KEY = 'claude-quota-dock-hidden';
const TAB_STORAGE_KEY = 'claude-quota-tab';

function getSavedTab(): TabName {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === 'claude' || saved === 'codex') {
      return saved;
    }
  } catch {}
  return 'claude';
}

function getSavedTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && ['light', 'dark', 'claude', 'claude-dark', 'minimal', 'minimal-dark', 'ocean'].includes(saved)) {
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
  if (!resetTime) return 'Unknown';
  try {
    const reset = new Date(resetTime);
    const now = new Date();
    const diff = reset.getTime() - now.getTime();
    if (diff <= 0) return 'Soon';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  } catch {
    return 'Unknown';
  }
}

function getClaudeTrayUsedPercent(quota: QuotaData | null): number | null {
  if (!quota) return null;

  if (quota.weeklyTotal) {
    return quota.weeklyTotal.percentage;
  }

  const weeklyUsedCandidates = [quota.weeklyOpus?.percentage, quota.weeklySonnet?.percentage]
    .filter((value): value is number => typeof value === 'number');
  if (weeklyUsedCandidates.length > 0) {
    return Math.max(...weeklyUsedCandidates);
  }

  if (quota.session) {
    return quota.session.percentage;
  }

  return null;
}

export default function App() {
  // Claude state
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [claudeLoaded, setClaudeLoaded] = useState(false);

  // Codex state
  const [codexConnected, setCodexConnected] = useState(false);
  const [codexUsedPercent, setCodexUsedPercent] = useState<number | null>(null);

  // UI state
  const [theme, setTheme] = useState<ThemeName>(getSavedTheme);
  const [dockHidden, setDockHidden] = useState<boolean>(getSavedDockHidden);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>(getSavedTab);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resize window
  useEffect(() => {
    const updateHeight = async () => {
      if (containerRef.current) {
        const height = containerRef.current.scrollHeight + 24;
        try {
          await backend.resizeWindow(Math.min(Math.max(height, 300), 600));
        } catch (err) {
          console.error('Failed to resize window:', err);
        }
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
  }, [activeTab, quota, codexConnected]);

  // Update tray icon based on active tab
  const updateTrayIcon = useCallback(async (percentage: number) => {
    try {
      await backend.updateTrayIcon(percentage);
    } catch (err) {
      console.error('Failed to update tray icon:', err);
    }
  }, []);

  // Fetch Claude quota (only when Claude tab is active)
  const fetchClaudeQuota = useCallback(async () => {
    try {
      setClaudeLoading(true);
      setClaudeError(null);
      const data = await backend.getQuota();

      if (data.error) {
        setClaudeError(data.error);
        setQuota(null);
      } else {
        setQuota(data);
      }
      setClaudeLoaded(true);
    } catch (err) {
      setClaudeError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setClaudeLoading(false);
    }
  }, []);

  // Load Claude data when switching to Claude tab (lazy load)
  useEffect(() => {
    if (activeTab === 'claude' && !claudeLoaded) {
      fetchClaudeQuota();
    }
  }, [activeTab, claudeLoaded, fetchClaudeQuota]);

  // Auto-refresh for active tab
  useEffect(() => {
    if (activeTab === 'claude') {
      const interval = setInterval(fetchClaudeQuota, 60000);
      return () => clearInterval(interval);
    }
    // Codex panel handles its own refresh
  }, [activeTab, fetchClaudeQuota]);

  // Update tray icon when active tab or data changes
  // Tray icon shows USED percentage.
  useEffect(() => {
    if (activeTab === 'claude') {
      // Claude tray percentage prefers weekly quota windows over session window.
      const used = getClaudeTrayUsedPercent(quota);
      if (used !== null) {
        updateTrayIcon(used);
        return;
      }
    } else if (activeTab === 'codex' && codexUsedPercent !== null) {
      // Codex passes used percentage.
      updateTrayIcon(codexUsedPercent);
      return;
    }

    // Keep a visible numeric tray title even before data is ready.
    updateTrayIcon(0);
  }, [activeTab, quota, codexUsedPercent, updateTrayIcon]);

  const handleThemeChange = useCallback((newTheme: ThemeName) => {
    setTheme(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
  }, []);

  const handleDockToggle = useCallback(() => {
    setDockHidden((prev) => {
      const newValue = !prev;
      backend.setDockVisibility(!newValue).catch(console.error);
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

  const handleRefresh = useCallback(() => {
    if (activeTab === 'claude') {
      fetchClaudeQuota();
    }
    // Codex panel handles its own refresh via internal state
  }, [activeTab, fetchClaudeQuota]);

  const handleOpenDashboard = useCallback(async () => {
    try {
      if (activeTab === 'claude') {
        await backend.openClaudeDashboard();
      } else {
        await backend.openCodexDashboard();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open dashboard';
      setToast(message);
      setTimeout(() => setToast(null), 2000);
    }
  }, [activeTab]);

  const handleQuit = async () => {
    try {
      await backend.quitApp();
    } catch (err) {
      console.error('Failed to quit:', err);
    }
  };

  // Callback from CodexPanel to update usage percentage for tray icon
  const handleCodexUsageChange = useCallback((usedPercent: number | null) => {
    setCodexUsedPercent(usedPercent);
  }, []);

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
          <ThemeSelector currentTheme={theme} onThemeChange={handleThemeChange} />
          <label className="dock-toggle">
            <input
              type="checkbox"
              checked={dockHidden}
              onChange={handleDockToggle}
            />
            <span className="toggle-label">Hide Dock</span>
          </label>
        </div>

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

        {activeTab === 'codex' && (
          <CodexPanel
            onConnectionChange={setCodexConnected}
            onUsageChange={handleCodexUsageChange}
          />
        )}

        <ActionButtons
          onRefresh={handleRefresh}
          onDashboard={handleOpenDashboard}
          onQuit={handleQuit}
          loading={claudeLoading}
        />
      </div>
    </div>
  );
}
