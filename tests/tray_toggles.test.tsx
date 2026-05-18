import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TrayToggles, { type TrayToggleEntry } from '../src/components/TrayToggles';

function entry(
  service: TrayToggleEntry['service'],
  label: string,
  enabled: boolean,
  canDisable: boolean,
  connected: boolean,
  disconnectedHint: string,
): TrayToggleEntry {
  return { service, label, enabled, canDisable, connected, disconnectedHint };
}

describe('TrayToggles', () => {
  test('tray status text is separate from the switch control', () => {
    const html = renderToStaticMarkup(
      <TrayToggles
        entries={[
          entry('claude', 'Claude Tray', true, true, true, 'Requires Claude Code login'),
          entry('codex', 'Codex Tray', true, true, false, 'Requires Codex App or CLI login'),
        ]}
        onToggle={() => {}}
      />,
    );

    expect(html).toContain('<div class="dock-toggle tray-toggle">');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Claude Tray toggle"');
    expect(html).toContain('aria-label="Codex Tray toggle"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('<label class="dock-toggle tray-toggle"');
    expect(html).toContain('Requires Codex App or CLI login');
  });

  test('disables the only remaining enabled tray toggle', () => {
    const html = renderToStaticMarkup(
      <TrayToggles
        entries={[
          entry('claude', 'Claude Tray', true, false, true, 'Requires Claude Code login'),
          entry('codex', 'Codex Tray', false, true, false, 'Requires Codex App or CLI login'),
        ]}
        onToggle={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Claude Tray toggle"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('disabled=""');
  });
});
