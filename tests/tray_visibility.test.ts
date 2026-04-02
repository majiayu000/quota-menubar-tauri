import { describe, expect, test } from 'bun:test';
import { shouldShowTray } from '../src/services/tray_visibility';

describe('shouldShowTray', () => {
  test('shows tray only when enabled and connected', () => {
    expect(shouldShowTray(true, true)).toBe(true);
    expect(shouldShowTray(true, false)).toBe(false);
    expect(shouldShowTray(false, true)).toBe(false);
    expect(shouldShowTray(false, false)).toBe(false);
  });
});
