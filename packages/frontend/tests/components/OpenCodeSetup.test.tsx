import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';

import OpenCodeSetup from '../../src/components/OpenCodeSetup';
import type { ModelAlias } from '../../src/services/api';

const writeText = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('navigator', {
  clipboard: { writeText },
});

describe('OpenCodeSetup', () => {
  beforeEach(() => {
    writeText.mockClear();
  });

  it('renders a paste-ready opencode.json block with a placeholder when the full key is unavailable', async () => {
    const { container } = render(() => (
      <OpenCodeSetup apiKey={null} keyPrefix="mnfst_live" baseUrl="http://localhost:38240/v1" />
    ));

    expect(container.textContent).toContain('~/.config/opencode/opencode.json');
    expect(container.textContent).not.toContain('project root');
    expect(container.textContent).toContain('"baseURL": "http://localhost:38240/v1"');
    expect(container.textContent).toContain('"apiKey": "mnfst_YOUR_KEY"');
    expect(container.textContent).not.toContain('"apiKey": "mnfst_live..."');
    expect(container.textContent).toContain('"model": "manifest/auto"');
    expect(screen.queryByLabelText('Reveal API key')).toBeNull();

    const copyConfig = container.querySelector(
      '.setup-cli-block__actions [aria-label="Copy to clipboard"]',
    );
    expect(copyConfig).not.toBeNull();
    fireEvent.click(copyConfig!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"apiKey": "mnfst_YOUR_KEY"'));
    });
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('mnfst_live...'));
  });

  it('reveals and hides the full API key without changing the copy payload', async () => {
    const { container } = render(() => (
      <OpenCodeSetup
        apiKey="mnfst_secret"
        keyPrefix="mnfst_live"
        baseUrl="http://localhost:38240/v1"
      />
    ));

    expect(container.textContent).toContain('"apiKey": "mnfst_live..."');
    expect(container.textContent).not.toContain('mnfst_secret');

    fireEvent.click(screen.getByLabelText('Reveal API key'));
    expect(container.textContent).toContain('"apiKey": "mnfst_secret"');

    fireEvent.click(screen.getByLabelText('Hide API key'));
    expect(container.textContent).toContain('"apiKey": "mnfst_live..."');

    const copyFullConfig = container.querySelector(
      '.setup-cli-block__actions [aria-label="Copy to clipboard"]',
    );
    expect(copyFullConfig).not.toBeNull();
    fireEvent.click(copyFullConfig!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"apiKey": "mnfst_secret"'));
    });
  });

  it('includes every enabled exposed model alias in the config', () => {
    const aliases = [
      {
        model_id: 'openai-subscription/gpt-5.5-high',
        display_name: 'GPT 5.5 High',
        enabled: true,
      },
      {
        model_id: 'openai-subscription/gpt-5.5-hidden',
        display_name: 'Hidden',
        enabled: false,
      },
    ] as ModelAlias[];

    const { container } = render(() => (
      <OpenCodeSetup
        apiKey={null}
        keyPrefix={null}
        baseUrl="http://localhost:38240/v1"
        modelAliases={aliases}
      />
    ));

    expect(container.textContent).toContain('"auto"');
    expect(container.textContent).toContain('"manifest/auto"');
    expect(container.textContent).toContain('"openai-subscription/gpt-5.5-high"');
    expect(container.textContent).toContain('"name": "GPT 5.5 High"');
    expect(container.textContent).not.toContain('gpt-5.5-hidden');
  });
});
