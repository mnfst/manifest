import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

const checkIsSelfHosted = vi.fn();

vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => checkIsSelfHosted(),
}));

import ProviderApiKeyTab from '../../src/components/ProviderApiKeyTab';
import type { ProviderDef } from '../../src/services/providers';

const provider = (overrides: Partial<ProviderDef> & { id: string; name: string }): ProviderDef =>
  ({
    color: '#333',
    initial: overrides.name.charAt(0),
    docUrl: 'https://docs.example',
    keyPlaceholder: 'key',
    ...overrides,
  }) as ProviderDef;

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  checkIsSelfHosted.mockReset();
});

const baseProps = {
  isConnected: () => false,
  isNoKeyConnected: () => false,
  onOpenDetail: vi.fn(),
  onOpenCustomForm: vi.fn(),
  onEditCustom: vi.fn(),
  onOpenLocalServer: vi.fn(),
};

describe('ProviderApiKeyTab', () => {
  it('sorts standard and custom providers alphabetically in the merged list', async () => {
    checkIsSelfHosted.mockResolvedValue(false);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[provider({ id: 'zee', name: 'Zeta' }), provider({ id: 'ant', name: 'Anthropic' })]}
        customProviders={[{ id: 'c1', name: 'Custom-B', base_url: 'https://b', models: [] } as never]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const names = Array.from(container.querySelectorAll('.provider-toggle__name')).map(
      (n) => n.textContent?.trim() ?? '',
    );
    // Sorted by name: Anthropic, Custom-B (has a "Custom" tag suffix), Zeta.
    expect(names[0]).toContain('Anthropic');
    expect(names[1]).toContain('Custom-B');
    expect(names[2]).toContain('Zeta');
  });

  it('greys out local-only providers in cloud mode with the self-hosted hint', async () => {
    checkIsSelfHosted.mockResolvedValue(false);

    const onOpenDetail = vi.fn();
    const onOpenCustomForm = vi.fn();
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[
          provider({ id: 'ollama', name: 'Ollama', localOnly: true } as ProviderDef),
          provider({ id: 'openai', name: 'OpenAI' }),
        ]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={onOpenDetail}
        onOpenCustomForm={onOpenCustomForm}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const names = Array.from(container.querySelectorAll('.provider-toggle__name')).map(
      (n) => n.textContent?.trim() ?? '',
    );
    // Both tiles render; local-only is greyed out to advertise the feature.
    expect(names).toContain('Ollama');
    expect(names).toContain('OpenAI');
    expect(container.textContent).toContain('Only available on self-hosted Manifest');
    const tiles = container.querySelectorAll('button.provider-toggle');
    const ollamaBtn = Array.from(tiles).find((b) =>
      b.textContent?.includes('Ollama'),
    ) as HTMLButtonElement;
    expect(ollamaBtn.disabled).toBe(true);
    fireEvent.click(ollamaBtn);
    expect(onOpenDetail).not.toHaveBeenCalled();
    expect(onOpenCustomForm).not.toHaveBeenCalled();
  });

  it('keeps local-only tiles clickable in self-hosted mode — no inline status copy', async () => {
    checkIsSelfHosted.mockResolvedValue(true);

    const onOpenDetail = vi.fn();
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[
          provider({ id: 'ollama', name: 'Ollama', localOnly: true } as ProviderDef),
        ]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={onOpenDetail}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    // No more "Install Ollama" / "Not running" copy on the tile itself —
    // that lives in the detail view now.
    expect(container.textContent).not.toContain('Install Ollama');
    expect(container.textContent).not.toContain('Not running');
    fireEvent.click(btn);
    expect(onOpenDetail).toHaveBeenCalledWith('ollama', 'api_key');
  });

  it('enables Ollama when self-hosted and the daemon is reachable, then invokes onOpenDetail', async () => {
    checkIsSelfHosted.mockResolvedValue(true);

    const onOpenDetail = vi.fn();
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[
          provider({ id: 'ollama', name: 'Ollama', localOnly: true } as ProviderDef),
        ]}
        customProviders={[]}
        isConnected={() => true}
        isNoKeyConnected={() => false}
        onOpenDetail={onOpenDetail}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(container.querySelector('.provider-toggle__switch--on')).not.toBeNull();
    fireEvent.click(btn);
    expect(onOpenDetail).toHaveBeenCalledWith('ollama', 'api_key');
  });

  it('renders a letter badge for custom providers with no logo, and wires onEditCustom', async () => {
    checkIsSelfHosted.mockResolvedValue(false);

    const onEditCustom = vi.fn();
    const customProvider = {
      id: 'c1',
      name: 'acme-host',
      base_url: 'https://api.example',
      models: [],
    } as never;

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[]}
        customProviders={[customProvider]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={onEditCustom}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const letter = container.querySelector('.provider-card__logo-letter');
    expect(letter?.textContent).toBe('A');
    fireEvent.click(container.querySelector('button.provider-toggle') as HTMLElement);
    expect(onEditCustom).toHaveBeenCalledWith(customProvider);
  });

  it('sorts a mix of standard and multiple custom providers by name', async () => {
    // With two customs the sort comparator reads b.cp.name at least once,
    // covering the second arm of the `b.kind === 'standard'` ternary.
    checkIsSelfHosted.mockResolvedValue(false);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[provider({ id: 'mid', name: 'MidProvider' })]}
        customProviders={[
          { id: 'c1', name: 'Alpha-Custom', base_url: 'https://a', models: [] } as never,
          { id: 'c2', name: 'Zulu-Custom', base_url: 'https://z', models: [] } as never,
        ]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const names = Array.from(container.querySelectorAll('.provider-toggle__name')).map((n) =>
      n.textContent?.trim() ?? '',
    );
    expect(names[0]).toContain('Alpha-Custom');
    expect(names[1]).toContain('MidProvider');
    expect(names[2]).toContain('Zulu-Custom');
  });

  it('treats a missing customProviders prop as an empty list', async () => {
    checkIsSelfHosted.mockResolvedValue(false);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[provider({ id: 'openai', name: 'OpenAI' })]}
        // customProviders deliberately omitted to cover the `?? []` branch
        customProviders={undefined as never}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const names = Array.from(container.querySelectorAll('.provider-toggle__name')).map(
      (n) => n.textContent?.trim() ?? '',
    );
    expect(names).toEqual(['OpenAI']);
  });

  it('enables a localOnly tile when the backend reports the server is running', async () => {
    checkIsSelfHosted.mockResolvedValue(true);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[
          provider({ id: 'lmstudio', name: 'LM Studio', localOnly: true } as ProviderDef),
        ]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('keeps a localOnly tile enabled and status-free when the server is down in self-hosted mode', async () => {
    checkIsSelfHosted.mockResolvedValue(true);

    const onOpenLocalServer = vi.fn();
    const lmsProv = provider({
      id: 'lmstudio',
      name: 'LM Studio',
      localOnly: true,
      defaultLocalPort: 1234,
    } as ProviderDef);
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[lmsProv]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={onOpenLocalServer}
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    // No "Not running" / setup-command copy on the tile — the detail
    // view surfaces it instead.
    expect(btn.disabled).toBe(false);
    expect(container.textContent).not.toContain('Not running on');
    expect(container.textContent).not.toContain('lms server start');
    fireEvent.click(btn);
    expect(onOpenLocalServer).toHaveBeenCalledWith(lmsProv);
  });

  it('hides the empty LM Studio tile when a custom provider already claims that canonical name', async () => {
    checkIsSelfHosted.mockResolvedValue(true);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[
          provider({
            id: 'lmstudio',
            name: 'LM Studio',
            localOnly: true,
            defaultLocalPort: 1234,
          } as ProviderDef),
          provider({ id: 'openai', name: 'OpenAI' }),
        ]}
        customProviders={[
          {
            id: 'cp-1',
            name: 'LM Studio',
            base_url: 'http://localhost:1234/v1',
            models: [],
          } as never,
        ]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    // Only one LM Studio row should be present (the connected custom one),
    // and it should NOT carry the "Custom" badge since it's a canonical
    // local-LLM.
    const lmsRows = Array.from(container.querySelectorAll('.provider-toggle__name')).filter(
      (n) => n.textContent?.includes('LM Studio'),
    );
    expect(lmsRows.length).toBe(1);
    expect(lmsRows[0].textContent).not.toContain('Custom');
    // Sanity: OpenAI still renders.
    expect(container.textContent).toContain('OpenAI');
  });

  it('keeps the "Custom" badge for genuinely custom providers (non-canonical name)', async () => {
    checkIsSelfHosted.mockResolvedValue(false);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[]}
        customProviders={[
          { id: 'c1', name: 'Acme Inference', base_url: 'https://api.acme', models: [] } as never,
        ]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    expect(container.textContent).toContain('Custom');
  });

  it('fires onOpenCustomForm when the "Add custom provider" chip is clicked', async () => {
    checkIsSelfHosted.mockResolvedValue(false);

    const onOpenCustomForm = vi.fn();
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={onOpenCustomForm}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    fireEvent.click(container.querySelector('.provider-modal__add-custom-chip') as HTMLElement);
    expect(onOpenCustomForm).toHaveBeenCalled();
  });

  it('opens the LocalServerDetailView when a reachable local-only tile with defaultLocalPort is clicked', async () => {
    checkIsSelfHosted.mockResolvedValue(true);

    const onOpenCustomForm = vi.fn();
    const onOpenDetail = vi.fn();
    const onOpenLocalServer = vi.fn();
    const lmsProv = provider({
      id: 'lmstudio',
      name: 'LM Studio',
      localOnly: true,
      noKeyRequired: true,
      defaultLocalPort: 1234,
    } as ProviderDef);
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[lmsProv]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={onOpenDetail}
        onOpenCustomForm={onOpenCustomForm}
        onEditCustom={vi.fn()}
        onOpenLocalServer={onOpenLocalServer}
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onOpenLocalServer).toHaveBeenCalledWith(lmsProv);
    expect(onOpenCustomForm).not.toHaveBeenCalled();
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('routes a local-only tile without defaultLocalPort through onOpenDetail (Ollama path)', async () => {
    checkIsSelfHosted.mockResolvedValue(true);

    const onOpenCustomForm = vi.fn();
    const onOpenDetail = vi.fn();
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[
          provider({ id: 'ollama', name: 'Ollama', localOnly: true } as ProviderDef),
        ]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={onOpenDetail}
        onOpenCustomForm={onOpenCustomForm}
        onEditCustom={vi.fn()}
        onOpenLocalServer={vi.fn()}
      />
    ));
    await flushMicrotasks();

    fireEvent.click(container.querySelector('button.provider-toggle') as HTMLButtonElement);
    expect(onOpenDetail).toHaveBeenCalledWith('ollama', 'api_key');
    expect(onOpenCustomForm).not.toHaveBeenCalled();
  });
});
