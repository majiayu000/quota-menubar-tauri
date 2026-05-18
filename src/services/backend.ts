import { invoke } from '@tauri-apps/api/core';
import type {
  AntigravityData,
  CodexData,
  CodexRateLimits,
  CodexStats,
  CostOverview,
  CostSource,
  CursorData,
  QuotaData,
} from '../types/models';

type TrayService = 'claude' | 'codex' | 'cursor' | 'antigravity';

export const backend = {
  getQuota() {
    return invoke<QuotaData>('get_quota');
  },

  getCodexInfo() {
    return invoke<CodexData>('get_codex_info');
  },

  getCodexStats() {
    return invoke<CodexStats>('get_codex_stats');
  },

  getCodexRateLimits() {
    return invoke<CodexRateLimits>('get_codex_rate_limits');
  },

  getCursorInfo() {
    return invoke<CursorData>('get_cursor_info');
  },

  getAntigravityInfo() {
    return invoke<AntigravityData>('get_antigravity_info');
  },

  getCostOverview(source: CostSource, force = false) {
    return invoke<CostOverview>('get_cost_overview', {
      source,
      currency: 'USD',
      timezone: null,
      force,
    });
  },

  openClaudeDashboard() {
    return invoke<void>('open_claude_dashboard');
  },

  openCodexDashboard() {
    return invoke<void>('open_codex_dashboard');
  },

  openCursorDashboard() {
    return invoke<void>('open_cursor_dashboard');
  },

  openAntigravityDashboard() {
    return invoke<void>('open_antigravity_dashboard');
  },

  updateTrayIcon(service: TrayService, percentage: number | null, visible: boolean) {
    return invoke<void>('update_tray_icon', {
      service,
      percentage: percentage == null ? null : Math.round(percentage),
      visible,
    });
  },

  resizeWindow(height: number) {
    return invoke<void>('resize_window', { height });
  },

  setDockVisibility(visible: boolean) {
    return invoke<void>('set_dock_visibility', { visible });
  },

  quitApp() {
    return invoke<void>('quit_app');
  },
};
