import { invoke } from '@tauri-apps/api/core';
import type {
  CodexData,
  CodexRateLimits,
  CodexStats,
  QuotaData,
  TrayDisplayData,
} from '../types/models';

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

  openClaudeDashboard() {
    return invoke<void>('open_claude_dashboard');
  },

  openCodexDashboard() {
    return invoke<void>('open_codex_dashboard');
  },

  updateTrayIcon(payload: TrayDisplayData) {
    return invoke<void>('update_tray_icon', {
      payload: {
        claudeConnected: payload.claudeConnected,
        claudePercentage: payload.claudePercentage == null ? null : Math.round(payload.claudePercentage),
        codexConnected: payload.codexConnected,
        codexPercentage: payload.codexPercentage == null ? null : Math.round(payload.codexPercentage),
      },
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
