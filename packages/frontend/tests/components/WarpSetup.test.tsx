import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@solidjs/testing-library';

import WarpSetup, { getWarpCustomEndpointJson } from '../../src/components/WarpSetup';
import type { ModelAlias } from '../../src/services/api';

const writeText = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('navigator', {
  clipboard: { writeText },
});

describe('WarpSetup', () => {
  const aliases = [
    {
      model_id: 'manifest/header-coding',
      display_name: 'Coding',
      enabled: true,
      source_kind: 'header_tier',
    },
    {
      model_id: 'openai-subscription/gpt-5.5-high',
      display_name: 'GPT 5.5 High',
      enabled: true,
      source_kind: 'direct',
    },
    {
      model_id: 'openai-subscription/gpt-5.5-hidden',
      display_name: 'Hidden',
      enabled: false,
      source_kind: 'direct',
    },
  ] as ModelAlias[];

  it('renders a Warp custom endpoint block with enabled aliases', async () => {
    const { container } = render(() => (
      <WarpSetup
        apiKey={null}
        keyPrefix="mnfst_live"
        baseUrl="http://localhost:38240/v1"
        modelAliases={aliases}
      />
    ));

    expect(container.textContent).toContain('custom inference endpoint');
    expect(container.textContent).toContain('config_key');
    expect(container.textContent).toContain('"api_key": "mnfst_live..."');
    expect(container.textContent).toContain('"name": "auto"');
    expect(container.textContent).toContain('"name": "manifest/auto"');
    expect(container.textContent).toContain('"name": "openai-subscription/gpt-5.5-high"');
    expect(container.textContent).toContain('"name": "manifest/header-coding"');
    expect(container.textContent).not.toContain('gpt-5.5-hidden');

    fireEvent.click(container.querySelector('[aria-label="Copy to clipboard"]')!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('"api_key": "mnfst_YOUR_KEY"'),
      );
    });
  });

  it('orders direct aliases before rule aliases after the auto rows', () => {
    const parsed = JSON.parse(
      getWarpCustomEndpointJson('http://localhost:38240/v1', 'mnfst_test', aliases),
    ) as { models: Array<{ name: string; alias: string }> };

    expect(parsed.models.map((model) => model.name)).toEqual([
      'auto',
      'manifest/auto',
      'openai-subscription/gpt-5.5-high',
      'manifest/header-coding',
    ]);
  });
});
