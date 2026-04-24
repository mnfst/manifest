import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

import ProviderLocalTab from '../../src/components/ProviderLocalTab';
import type { ProviderDef } from '../../src/services/providers';

const provider = (overrides: Partial<ProviderDef> & { id: string; name: string }): ProviderDef =>
  ({
    color: '#333',
    initial: overrides.name.charAt(0),
    docUrl: 'https://docs.example',
    keyPlaceholder: 'key',
    localOnly: true,
    ...overrides,
  }) as ProviderDef;

const baseProps = {
  isConnected: () => false,
  onToggle: vi.fn(),
  busy: () => false,
  onOpenDetail: vi.fn(),
  onEditCustom: vi.fn(),
  onOpenLocalServer: vi.fn(),
};

describe('ProviderLocalTab', () => {
  it('renders local provider tiles alphabetically', () => {
    const { container } = render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[
          provider({ id: 'ollama', name: 'Ollama' }),
          provider({ id: 'lmstudio', name: 'LM Studio' }),
        ]}
        customProviders={[]}
      />
    ));
    const names = Array.from(container.querySelectorAll('.provider-toggle__name')).map((n) =>
      n.textContent?.trim() ?? '',
    );
    expect(names).toEqual(['LM Studio', 'Ollama']);
  });

  it('opens LocalServerDetailView for tiles with defaultLocalPort', () => {
    const onOpenLocalServer = vi.fn();
    const lmsProv = provider({
      id: 'lmstudio',
      name: 'LM Studio',
      defaultLocalPort: 1234,
    } as ProviderDef);
    const { container } = render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[lmsProv]}
        customProviders={[]}
        onOpenLocalServer={onOpenLocalServer}
      />
    ));
    fireEvent.click(container.querySelector('button.provider-toggle') as HTMLButtonElement);
    expect(onOpenLocalServer).toHaveBeenCalledWith(lmsProv);
  });

  it('routes tiles without defaultLocalPort through onOpenDetail with local auth type', () => {
    const onOpenDetail = vi.fn();
    const { container } = render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[provider({ id: 'ollama', name: 'Ollama' })]}
        customProviders={[]}
        onOpenDetail={onOpenDetail}
      />
    ));
    fireEvent.click(container.querySelector('button.provider-toggle') as HTMLButtonElement);
    expect(onOpenDetail).toHaveBeenCalledWith('ollama', 'local');
  });

  it('hides the empty LM Studio tile when a canonical-named custom provider already exists', () => {
    const { container } = render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[
          provider({ id: 'lmstudio', name: 'LM Studio', defaultLocalPort: 1234 } as ProviderDef),
        ]}
        customProviders={[
          {
            id: 'cp-1',
            name: 'LM Studio',
            base_url: 'http://localhost:1234/v1',
            models: [],
          } as never,
        ]}
      />
    ));
    // Only one LM Studio row — the custom one takes over.
    const lmsRows = Array.from(container.querySelectorAll('.provider-toggle__name')).filter(
      (n) => n.textContent?.includes('LM Studio'),
    );
    expect(lmsRows.length).toBe(1);
  });

  it('does not surface freeform custom providers — those live in the API Keys tab', () => {
    const { container } = render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[]}
        customProviders={[
          { id: 'cp-1', name: 'Groq', base_url: 'https://api.groq', models: [] } as never,
        ]}
      />
    ));
    expect(container.textContent).not.toContain('Groq');
  });

  it('fires onEditCustom when a canonical local custom row is clicked while disconnected', () => {
    const onEditCustom = vi.fn();
    const custom = {
      id: 'cp-ollama',
      name: 'Ollama',
      base_url: 'http://localhost:11434/v1',
      models: [],
    };
    render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[]}
        customProviders={[custom as never]}
        onEditCustom={onEditCustom}
      />
    ));
    const btn = document.querySelector('button.provider-toggle') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onEditCustom).toHaveBeenCalledWith(custom);
  });

  it('shows the connected-switch when isConnected returns true', () => {
    const { container } = render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[provider({ id: 'ollama', name: 'Ollama' })]}
        customProviders={[]}
        isConnected={() => true}
      />
    ));
    expect(container.querySelector('.provider-toggle__switch--on')).not.toBeNull();
  });

  it('disconnects a connected standard tile on click instead of reopening the detail view', () => {
    const onToggle = vi.fn();
    const onOpenDetail = vi.fn();
    const onOpenLocalServer = vi.fn();
    render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[provider({ id: 'ollama', name: 'Ollama' })]}
        customProviders={[]}
        isConnected={() => true}
        onToggle={onToggle}
        onOpenDetail={onOpenDetail}
        onOpenLocalServer={onOpenLocalServer}
      />
    ));
    fireEvent.click(document.querySelector('button.provider-toggle') as HTMLButtonElement);
    expect(onToggle).toHaveBeenCalledWith('ollama');
    expect(onOpenDetail).not.toHaveBeenCalled();
    expect(onOpenLocalServer).not.toHaveBeenCalled();
  });

  it('disconnects a connected custom tile via its custom:<uuid> provider key', () => {
    const onToggle = vi.fn();
    const onEditCustom = vi.fn();
    render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[]}
        customProviders={[
          {
            id: 'cp-lms',
            name: 'LM Studio',
            base_url: 'http://localhost:1234/v1',
            models: [],
          } as never,
        ]}
        isConnected={(key) => key === 'custom:cp-lms'}
        onToggle={onToggle}
        onEditCustom={onEditCustom}
      />
    ));
    fireEvent.click(document.querySelector('button.provider-toggle') as HTMLButtonElement);
    expect(onToggle).toHaveBeenCalledWith('custom:cp-lms');
    expect(onEditCustom).not.toHaveBeenCalled();
  });

  it('disables all tiles while busy is true', () => {
    const { container } = render(() => (
      <ProviderLocalTab
        {...baseProps}
        localProviders={[provider({ id: 'ollama', name: 'Ollama' })]}
        customProviders={[]}
        busy={() => true}
      />
    ));
    const btn = container.querySelector('button.provider-toggle') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
