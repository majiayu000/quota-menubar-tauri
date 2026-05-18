import type { CSSProperties } from 'react';

export function formatPlanType(planType?: string, fallback = 'Unknown'): string {
  if (!planType) return fallback;
  return planType.charAt(0).toUpperCase() + planType.slice(1);
}

export function getProgressColor(usedPercent: number): string {
  if (usedPercent >= 90) return '#ef4444';
  if (usedPercent >= 75) return '#f59e0b';
  return '#22c55e';
}

export function getProgressStyle(usedPercent: number): CSSProperties {
  const clamped = Math.min(Math.max(usedPercent, 0), 100);
  return {
    '--progress-color': getProgressColor(usedPercent),
    '--progress-scale': String(clamped / 100),
  } as CSSProperties;
}
