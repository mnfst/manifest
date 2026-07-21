import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.stubGlobal('navigator', {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import NanobotSetup from '../../src/components/NanobotSetup';

describe('NanobotSetup', () => {
  const baseProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: 'http://localhost:3001/v1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the config.json instruction with highlighted path and keys', () => {
    const { container } = render(() => <NanobotSetup {...baseProps} />);
    const hint = container.querySelector('.setup-method__hint');
    const codes = container.querySelectorAll('.setup-model-hint__code');
    const labels = Array.from(codes).map((c) => c.textContent);
    expect(hint?.textContent).toBe(
      'Edit ~/.nanobot/config.json by updating the existing agents.defaults values first, then add the custom provider block below.',
    );
    expect(labels).toEqual(['~/.nanobot/config.json', 'agents.defaults', 'custom']);
  });

  it('renders the JSON config with custom provider and apiBase', () => {
    const { container } = render(() => <NanobotSetup {...baseProps} />);
    const text = container.textContent ?? '';
    expect(text).toContain('"agents"');
    expect(text).toContain('"defaults"');
    expect(text).toContain('"provider"');
    expect(text).toContain('"custom"');
    expect(text).toContain('"model"');
    expect(text).toContain('"auto"');
    expect(text).toContain('"providers"');
    expect(text).toContain('apiKey');
    expect(text).toContain('apiBase');
  });

  it('emits the baseUrl verbatim into the JSON (no /v1 stripping)', () => {
    // Nanobot's apiBase points at the OpenAI-compatible endpoint, which is
    // /v1 on Manifest — preserve the suffix unlike the Anthropic-compatible
    // Claude Code setup.
    const { container } = render(() => (
      <NanobotSetup {...baseProps} baseUrl="http://localhost:3001/v1" />
    ));
    expect(container.textContent).toContain('http://localhost:3001/v1');
  });

  it('masks the API key when only a prefix is available', () => {
    const { container } = render(() => <NanobotSetup {...baseProps} keyPrefix="mnfst_abc" />);
    expect(container.textContent).toContain('mnfst_abc...');
    expect(container.querySelector('[aria-label="Reveal API key"]')).toBeNull();
    expect(container.querySelector('[aria-label="Hide API key"]')).toBeNull();
  });

  it("uses 'mnfst_YOUR_KEY' placeholder when neither full key nor prefix is set", () => {
    const { container } = render(() => <NanobotSetup {...baseProps} />);
    expect(container.textContent).toContain('mnfst_YOUR_KEY');
  });

  it('toggles the API key reveal when the eye button is clicked', () => {
    const { container } = render(() => (
      <NanobotSetup {...baseProps} apiKey="mnfst_full_secret_value" keyPrefix="mnfst_full" />
    ));
    expect(container.textContent).toContain('mnfst_full...');
    expect(container.textContent).not.toContain('mnfst_full_secret_value');

    const reveal = container.querySelector('[aria-label="Reveal API key"]') as HTMLButtonElement;
    expect(reveal).not.toBeNull();
    fireEvent.click(reveal);
    expect(container.textContent).toContain('mnfst_full_secret_value');

    const hide = container.querySelector('[aria-label="Hide API key"]') as HTMLButtonElement;
    expect(hide).not.toBeNull();
    fireEvent.click(hide);
    expect(container.textContent).not.toContain('mnfst_full_secret_value');
  });

  it('copy button always uses the real key (not the masked one)', () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    const { container } = render(() => (
      <NanobotSetup {...baseProps} apiKey="mnfst_full_secret_value" keyPrefix="mnfst_full" />
    ));
    const copyButton = container.querySelector(
      'button[aria-label*="Copy" i]',
    ) as HTMLButtonElement | null;
    expect(copyButton).not.toBeNull();
    fireEvent.click(copyButton!);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('mnfst_full_secret_value');
  });

  it('renders inside a setup-agents-card so card styling applies', () => {
    const { container } = render(() => <NanobotSetup {...baseProps} />);
    expect(container.querySelector('.setup-agents-card')).not.toBeNull();
  });

  it('uses a JSON code block (not bash, not yaml)', () => {
    const { container } = render(() => <NanobotSetup {...baseProps} />);
    const codeEl = container.querySelector('.hljs.language-json');
    expect(codeEl).not.toBeNull();
  });
});
