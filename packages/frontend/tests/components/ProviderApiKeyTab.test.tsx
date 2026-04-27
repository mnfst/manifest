import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

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

const baseProps = {
  isConnected: () => false,
  isNoKeyConnected: () => false,
  onOpenDetail: vi.fn(),
  onOpenCustomForm: vi.fn(),
  onEditCustom: vi.fn(),
};

describe('ProviderApiKeyTab', () => {
  it('sorts standard and custom providers alphabetically in the merged list', async () => {
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

  it('renders a letter badge for custom providers with no logo, and wires onEditCustom', async () => {
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

  it('hides a custom provider named after a canonical local tile so it doesn\'t duplicate the Local tab', async () => {
    // LM Studio lives under the Local tab now; if someone created a custom
    // provider named "LM Studio" it would otherwise show up in both tabs.
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[provider({ id: 'openai', name: 'OpenAI' })]}
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
      />
    ));
    await flushMicrotasks();

    const names = Array.from(container.querySelectorAll('.provider-toggle__name')).map(
      (n) => n.textContent?.trim() ?? '',
    );
    expect(names).not.toEqual(expect.arrayContaining([expect.stringContaining('LM Studio')]));
    expect(container.textContent).toContain('OpenAI');
  });

  it('keeps the "Custom" badge for genuinely custom providers (non-canonical name)', async () => {
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
      />
    ));
    await flushMicrotasks();

    expect(container.textContent).toContain('Custom');
  });

  it('fires onOpenCustomForm when the "Add custom provider" chip is clicked', async () => {
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

  it('routes a standard API-key tile through onOpenDetail with api_key auth type', async () => {
    const onOpenDetail = vi.fn();
    const { container } = render(() => (
      <ProviderApiKeyTab
        apiKeyProviders={[provider({ id: 'openai', name: 'OpenAI' })]}
        customProviders={[]}
        isConnected={() => false}
        isNoKeyConnected={() => false}
        onOpenDetail={onOpenDetail}
        onOpenCustomForm={vi.fn()}
        onEditCustom={vi.fn()}
      />
    ));
    await flushMicrotasks();

    fireEvent.click(container.querySelector('button.provider-toggle') as HTMLButtonElement);
    expect(onOpenDetail).toHaveBeenCalledWith('openai', 'api_key');
  });
});
