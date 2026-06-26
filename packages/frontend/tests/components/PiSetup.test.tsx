import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@solidjs/testing-library';

import PiSetup from '../../src/components/PiSetup';
import type { ModelAlias } from '../../src/services/api';

const writeText = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('navigator', {
  clipboard: { writeText },
});

describe('PiSetup', () => {
  it('renders a models.json block with enabled aliases', async () => {
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
      <PiSetup
        apiKey={null}
        keyPrefix="mnfst_live"
        baseUrl="http://localhost:38240/v1"
        modelAliases={aliases}
      />
    ));

    expect(container.textContent).toContain('~/.pi/agent/models.json');
    expect(container.textContent).toContain('"api": "openai-completions"');
    expect(container.textContent).toContain('"apiKey": "mnfst_live..."');
    expect(container.textContent).toContain('"id": "auto"');
    expect(container.textContent).toContain('"id": "manifest/auto"');
    expect(container.textContent).toContain('"id": "openai-subscription/gpt-5.5-high"');
    expect(container.textContent).not.toContain('gpt-5.5-hidden');

    fireEvent.click(container.querySelector('[aria-label="Copy to clipboard"]')!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"apiKey": "mnfst_YOUR_KEY"'));
    });
  });
});
