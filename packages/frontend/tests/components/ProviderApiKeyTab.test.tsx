import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

const checkIsSelfHosted = vi.fn();
const checkIsOllamaAvailable = vi.fn();

vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => checkIsSelfHosted(),
  checkIsOllamaAvailable: () => checkIsOllamaAvailable(),
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
  checkIsOllamaAvailable.mockReset();
});

describe('ProviderApiKeyTab', () => {
  it('sorts standard and custom providers alphabetically in the merged list', async () => {
    checkIsSelfHosted.mockResolvedValue(false);
    checkIsOllamaAvailable.mockResolvedValue(false);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[provider({ id: 'zee', name: 'Zeta' }), provider({ id: 'ant', name: 'Anthropic' })]}
        customProviders={[{ id: 'c1', name: 'Custom-B', base_url: 'https://b', models: [] } as never]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
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

  it('disables local-only providers when not in the self-hosted version and shows the hint', async () => {
    checkIsSelfHosted.mockResolvedValue(false);
    checkIsOllamaAvailable.mockResolvedValue(false);

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
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(container.textContent).toContain('Only available on self-hosted Manifest');
    fireEvent.click(btn);
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('shows the "install Ollama on host" hint when self-hosted but Ollama is unreachable', async () => {
    checkIsSelfHosted.mockResolvedValue(true);
    checkIsOllamaAvailable.mockResolvedValue(false);

    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[
          provider({ id: 'ollama', name: 'Ollama', localOnly: true } as ProviderDef),
        ]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={vi.fn()}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(container.textContent).toContain(
      'Install Ollama on your host from ollama.com, then click to connect',
    );
  });

  it('enables Ollama when self-hosted and the daemon is reachable, then invokes onOpenDetail', async () => {
    checkIsSelfHosted.mockResolvedValue(true);
    checkIsOllamaAvailable.mockResolvedValue(true);

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
    checkIsOllamaAvailable.mockResolvedValue(false);

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
    checkIsOllamaAvailable.mockResolvedValue(false);

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
    checkIsOllamaAvailable.mockResolvedValue(false);

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
      />
    ));
    await flushMicrotasks();

    const names = Array.from(container.querySelectorAll('.provider-toggle__name')).map(
      (n) => n.textContent?.trim() ?? '',
    );
    expect(names).toEqual(['OpenAI']);
  });

  it('renders a non-Ollama localOnly provider as enabled in self-hosted mode (falls through to return false)', async () => {
    // Covers the branch on line 85 where prov.localOnly && isSelfHosted
    // but the provider is NOT ollama, so disabled() returns false.
    checkIsSelfHosted.mockResolvedValue(true);
    checkIsOllamaAvailable.mockResolvedValue(false);

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
      />
    ));
    await flushMicrotasks();

    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('fires onOpenCustomForm when the "Add custom provider" chip is clicked', async () => {
    checkIsSelfHosted.mockResolvedValue(false);
    checkIsOllamaAvailable.mockResolvedValue(false);

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
      />
    ));
    await flushMicrotasks();

    fireEvent.click(container.querySelector('.provider-modal__add-custom-chip') as HTMLElement);
    expect(onOpenCustomForm).toHaveBeenCalled();
  });
});
