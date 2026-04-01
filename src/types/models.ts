export interface UsageInfo {
  used: number;
  limit: number;
  percentage: number;
  resetTime?: string;
}

export interface QuotaData {
  connected: boolean;
  session?: UsageInfo;
  weeklyTotal?: UsageInfo;
  weeklyOpus?: UsageInfo;
  weeklySonnet?: UsageInfo;
  error?: string;
}

export interface CodexData {
  connected: boolean;
  planType?: string;
  accountId?: string;
  subscriptionUntil?: string;
  email?: string;
  error?: string;
}

export interface CodexStats {
  totalSessions: number;
  todaySessions: number;
  lastActivity?: string;
}

export interface CodexRateLimitWindow {
  usedPercent: number;
  windowMinutes?: number;
  resetsAt?: number;
}

export interface CodexCredits {
  hasCredits: boolean;
  unlimited: boolean;
  balance?: string;
}

export interface CodexRateLimits {
  connected: boolean;
  planType?: string;
  primary?: CodexRateLimitWindow;
  secondary?: CodexRateLimitWindow;
  credits?: CodexCredits;
  error?: string;
}

export interface CodexSnapshot {
  info: CodexData | null;
  stats: CodexStats | null;
  rateLimits: CodexRateLimits | null;
  loading: boolean;
  error: string | null;
}

export interface TrayDisplayData {
  claudeConnected: boolean;
  claudePercentage: number | null;
  codexConnected: boolean;
  codexPercentage: number | null;
}
