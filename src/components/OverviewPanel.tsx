import type { CodexSnapshot, QuotaData, UsageInfo } from '../types/models';

interface OverviewPanelProps {
  claudeQuota: QuotaData | null;
  claudeLoading: boolean;
  claudeError: string | null;
  codexSnapshot: CodexSnapshot;
  onOpenClaudeDashboard: () => void;
  onOpenCodexDashboard: () => void;
}

interface SummaryMetric {
  label: string;
  value: string;
}

interface PrimarySummary {
  label: string;
  percentage: number;
  resetsIn: string;
}

function getStatusTone(percentage: number): 'good' | 'warning' | 'critical' {
  if (percentage >= 80) return 'critical';
  if (percentage >= 50) return 'warning';
  return 'good';
}

function formatClaudeResetTime(resetTime?: string): string {
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

function formatCodexResetTime(resetAt?: number): string {
  if (!resetAt) return 'N/A';

  const diffMs = resetAt * 1000 - Date.now();
  if (diffMs <= 0) return 'now';

  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  return `${Math.round(diffHours / 24)}d`;
}

function formatPlanType(planType?: string): string {
  if (!planType) return 'Unknown';
  return planType.charAt(0).toUpperCase() + planType.slice(1);
}

function formatWindowLabel(minutes?: number): string {
  if (!minutes) return 'Limit';
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return days === 7 ? 'Weekly' : `${days}d`;
  }
  if (minutes >= 60) {
    return `${Math.round(minutes / 60)}h`;
  }
  return `${minutes}m`;
}

function getClaudePrimarySummary(quota: QuotaData | null): PrimarySummary | null {
  if (!quota) return null;
  if (quota.weeklyTotal) {
    return {
      label: '7-Day Usage',
      percentage: Math.round(quota.weeklyTotal.percentage),
      resetsIn: formatClaudeResetTime(quota.weeklyTotal.resetTime),
    };
  }

  const weeklyCandidates: Array<{ label: string; usage: UsageInfo }> = [];
  if (quota.weeklyOpus) {
    weeklyCandidates.push({ label: 'Opus (7-Day)', usage: quota.weeklyOpus });
  }
  if (quota.weeklySonnet) {
    weeklyCandidates.push({ label: 'Sonnet (7-Day)', usage: quota.weeklySonnet });
  }
  if (weeklyCandidates.length > 0) {
    const primary = weeklyCandidates.reduce((current, next) =>
      next.usage.percentage > current.usage.percentage ? next : current,
    );
    return {
      label: primary.label,
      percentage: Math.round(primary.usage.percentage),
      resetsIn: formatClaudeResetTime(primary.usage.resetTime),
    };
  }

  if (quota.session) {
    return {
      label: '5-Hour Usage',
      percentage: Math.round(quota.session.percentage),
      resetsIn: formatClaudeResetTime(quota.session.resetTime),
    };
  }

  return null;
}

function getClaudeMetrics(quota: QuotaData | null): SummaryMetric[] {
  if (!quota) return [];

  const metrics: SummaryMetric[] = [];
  if (quota.session) {
    metrics.push({ label: '5h', value: `${Math.round(quota.session.percentage)}%` });
  }
  if (quota.weeklyTotal) {
    metrics.push({ label: '7d', value: `${Math.round(quota.weeklyTotal.percentage)}%` });
  }
  if (quota.weeklyOpus) {
    metrics.push({ label: 'Opus', value: `${Math.round(quota.weeklyOpus.percentage)}%` });
  }
  if (quota.weeklySonnet) {
    metrics.push({ label: 'Sonnet', value: `${Math.round(quota.weeklySonnet.percentage)}%` });
  }
  return metrics.slice(0, 4);
}

function getCodexPrimarySummary(snapshot: CodexSnapshot): PrimarySummary | null {
  const limits = snapshot.rateLimits;
  if (!limits) return null;

  if (limits.secondary) {
    return {
      label: `${formatWindowLabel(limits.secondary.windowMinutes)} limit`,
      percentage: Math.round(limits.secondary.usedPercent),
      resetsIn: formatCodexResetTime(limits.secondary.resetsAt),
    };
  }

  if (limits.primary) {
    return {
      label: `${formatWindowLabel(limits.primary.windowMinutes)} limit`,
      percentage: Math.round(limits.primary.usedPercent),
      resetsIn: formatCodexResetTime(limits.primary.resetsAt),
    };
  }

  return null;
}

function getCodexMetrics(snapshot: CodexSnapshot): SummaryMetric[] {
  const metrics: SummaryMetric[] = [];
  if (snapshot.rateLimits?.primary) {
    metrics.push({
      label: 'Short',
      value: `${Math.round(snapshot.rateLimits.primary.usedPercent)}%`,
    });
  }
  if (snapshot.rateLimits?.secondary) {
    metrics.push({
      label: 'Weekly',
      value: `${Math.round(snapshot.rateLimits.secondary.usedPercent)}%`,
    });
  }
  if (snapshot.rateLimits?.credits?.hasCredits) {
    metrics.push({
      label: 'Credits',
      value: snapshot.rateLimits.credits.unlimited
        ? 'Unlimited'
        : snapshot.rateLimits.credits.balance || '0',
    });
  }
  if (snapshot.stats && snapshot.stats.todaySessions > 0) {
    metrics.push({
      label: 'Today',
      value: `${snapshot.stats.todaySessions} sessions`,
    });
  }
  return metrics.slice(0, 4);
}

function renderMetrics(metrics: SummaryMetric[]) {
  if (metrics.length === 0) {
    return <div className="overview-empty-inline">No additional details</div>;
  }

  return (
    <div className="overview-metrics">
      {metrics.map((metric) => (
        <div className="overview-metric" key={`${metric.label}-${metric.value}`}>
          <span className="overview-metric-label">{metric.label}</span>
          <span className="overview-metric-value">{metric.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPanel({
  claudeQuota,
  claudeLoading,
  claudeError,
  codexSnapshot,
  onOpenClaudeDashboard,
  onOpenCodexDashboard,
}: OverviewPanelProps) {
  const claudePrimary = getClaudePrimarySummary(claudeQuota);
  const claudeMetrics = getClaudeMetrics(claudeQuota);

  const codexPrimary = getCodexPrimarySummary(codexSnapshot);
  const codexMetrics = getCodexMetrics(codexSnapshot);
  const codexConnected =
    Boolean(codexSnapshot.rateLimits?.connected) || Boolean(codexSnapshot.info?.connected);
  const codexPlan = codexSnapshot.rateLimits?.planType || codexSnapshot.info?.planType;

  return (
    <div className="overview-panel">
      <div className="overview-header">
        <div>
          <div className="section-title">OVERVIEW</div>
          <p className="overview-copy">Claude Code and Codex in one quick tray view.</p>
        </div>
      </div>

      <div className="overview-cards">
        <div className="quota-card overview-card">
          <div className="overview-card-head">
            <div className="overview-service">
              <span
                className={`status-dot ${
                  claudeQuota?.connected ? 'connected' : 'disconnected'
                }`}
              />
              <span className="overview-service-name">Claude Code</span>
            </div>
          </div>

          {claudeLoading && !claudeQuota ? (
            <div className="loading-state">Loading Claude quota...</div>
          ) : claudePrimary ? (
            <>
              <div className="overview-primary">
                <div>
                  <div className="overview-percent">{claudePrimary.percentage}%</div>
                  <div className="overview-label">{claudePrimary.label}</div>
                </div>
                <div className="overview-reset">Resets in {claudePrimary.resetsIn}</div>
              </div>

              <div className="progress-bar overview-progress">
                <div
                  className={`progress-fill ${getStatusTone(claudePrimary.percentage)}`}
                  style={{ width: `${Math.min(Math.max(claudePrimary.percentage, 0), 100)}%` }}
                />
              </div>

              {renderMetrics(claudeMetrics)}
            </>
          ) : (
            <div className="overview-empty-block">
              <p>{claudeError || 'Claude Code is not connected.'}</p>
              <p className="hint">Run `claude login` if you expect quota data here.</p>
            </div>
          )}

          <button className="overview-dashboard-btn" onClick={onOpenClaudeDashboard}>
            Open Claude Dashboard
          </button>
        </div>

        <div className="quota-card overview-card">
          <div className="overview-card-head">
            <div className="overview-service">
              <span className={`status-dot ${codexConnected ? 'connected' : 'disconnected'}`} />
              <span className="overview-service-name">Codex</span>
            </div>
            {codexPlan && <span className="plan-tag">{formatPlanType(codexPlan)}</span>}
          </div>

          {codexSnapshot.loading && !codexSnapshot.info && !codexSnapshot.rateLimits ? (
            <div className="loading-state">Loading Codex info...</div>
          ) : codexPrimary ? (
            <>
              <div className="overview-primary">
                <div>
                  <div className="overview-percent">{codexPrimary.percentage}%</div>
                  <div className="overview-label">{codexPrimary.label}</div>
                </div>
                <div className="overview-reset">Resets in {codexPrimary.resetsIn}</div>
              </div>

              <div className="progress-bar overview-progress">
                <div
                  className={`progress-fill ${getStatusTone(codexPrimary.percentage)}`}
                  style={{ width: `${Math.min(Math.max(codexPrimary.percentage, 0), 100)}%` }}
                />
              </div>

              {renderMetrics(codexMetrics)}
            </>
          ) : (
            <div className="overview-empty-block">
              <p>{codexSnapshot.error || 'Codex is not connected.'}</p>
              <p className="hint">Run `codex` in terminal to login if needed.</p>
            </div>
          )}

          <button className="overview-dashboard-btn" onClick={onOpenCodexDashboard}>
            Open Codex Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
