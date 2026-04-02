import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import TrayToggles from '../src/components/TrayToggles';

describe('TrayToggles', () => {
  test('tray status text is separate from the switch control', () => {
    const html = renderToStaticMarkup(
      <TrayToggles
        claudeEnabled={true}
        codexEnabled={true}
        claudeConnected={true}
        codexConnected={false}
        onToggle={() => {}}
      />,
    );

    expect(html).toContain('<div class="dock-toggle tray-toggle">');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Claude Tray toggle"');
    expect(html).toContain('aria-label="Codex Tray toggle"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('<label class="dock-toggle tray-toggle"');
  });
});
