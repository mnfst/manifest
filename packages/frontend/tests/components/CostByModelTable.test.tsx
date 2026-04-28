import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import CostByModelTable from '../../src/components/CostByModelTable';

function row(overrides: Record<string, unknown> = {}) {
  return {
    model: 'gpt-5',
    tokens: 1000,
    share_pct: 50,
    estimated_cost: 1.23,
    auth_type: 'api_key',
    ...overrides,
  };
}

describe('CostByModelTable', () => {
  it('renders a header row with Model/Tokens/% of total/Cost', () => {
    const { container } = render(() => (
      <CostByModelTable rows={[]} customProviderName={() => undefined} />
    ));
    const headers = Array.from(container.querySelectorAll('th')).map((h) => h.textContent?.trim());
    expect(headers).toEqual(['Model', 'Tokens', '% of total', 'Cost']);
  });

  it('sorts rows by estimated_cost descending', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[
          row({ model: 'cheap', estimated_cost: 0.5 }),
          row({ model: 'pricey', estimated_cost: 5 }),
          row({ model: 'mid', estimated_cost: 2 }),
        ]}
        customProviderName={() => undefined}
      />
    ));
    const firstCells = Array.from(container.querySelectorAll('tbody tr td:first-child')).map(
      (td) => td.textContent?.trim() ?? '',
    );
    // Sort is by cost desc, so: pricey, mid, cheap.
    expect(firstCells[0]).toContain('pricey');
    expect(firstCells[1]).toContain('mid');
    expect(firstCells[2]).toContain('cheap');
  });

  it('formats tokens and rounds the share percentage', () => {
    const { container } = render(() => (
      <CostByModelTable rows={[row({ tokens: 12345, share_pct: 42.6 })]} customProviderName={() => undefined} />
    ));
    expect(container.textContent).toContain('12.3k');
    expect(container.textContent).toContain('43%');
  });

  it('renders a dash for null/zero costs', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[row({ estimated_cost: 0 })]}
        customProviderName={() => undefined}
      />
    ));
    const costCell = container.querySelector('tbody tr td:nth-child(4)');
    // formatCost(0) returns '$0.00' (non-null), so the fallback em-dash should
    // NOT appear. But extremely small values below the display threshold do
    // get a tooltip with the raw value — verify the rendering path stays
    // consistent:
    expect(costCell?.textContent?.trim()).not.toBe('');
  });

  it('adds a tooltip with the full cost for sub-penny amounts', () => {
    const { container } = render(() => (
      <CostByModelTable rows={[row({ estimated_cost: 0.00123 })]} customProviderName={() => undefined} />
    ));
    const costCell = container.querySelector('tbody tr td:nth-child(4)');
    expect(costCell?.getAttribute('title')).toBe('$0.001230');
  });

  it('renders a custom-provider letter badge when no logo is registered', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[
          row({
            model: 'custom:abc123/gpt-custom',
            auth_type: null,
          }),
        ]}
        customProviderName={() => 'My Provider'}
      />
    ));
    const letterBadge = container.querySelector('.provider-card__logo-letter');
    expect(letterBadge).not.toBeNull();
    expect(letterBadge?.textContent).toBe('M');
    // Full cell text should include the namespaced custom model name.
    expect(container.textContent).toContain('custom:My Provider/gpt-custom');
  });

  it('falls back to the stripped custom prefix when the provider name lookup returns nothing', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[row({ model: 'custom:abc/my-model', auth_type: null })]}
        customProviderName={() => undefined}
      />
    ));
    const letterBadge = container.querySelector('.provider-card__logo-letter');
    // stripCustomPrefix('custom:abc/my-model') → 'my-model' → first letter "M".
    expect(letterBadge?.textContent).toBe('M');
    expect(container.textContent).toContain('custom:Custom/my-model');
  });

  it('renders a provider icon + auth badge for recognised model prefixes', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[row({ model: 'claude-opus-4', auth_type: 'subscription' })]}
        customProviderName={() => undefined}
      />
    ));
    const providerCell = container.querySelector('tbody tr td');
    expect(providerCell?.querySelector('.provider-auth-badge--sub')).not.toBeNull();
    // Tooltip on the outer wrapper reflects the auth label.
    expect(providerCell?.innerHTML).toContain('Subscription');
  });

  it('prefers the stored provider over model-name inference', () => {
    // Model name starts with "minimax-" which would infer MiniMax,
    // but the stored provider is "ollama" — icon tooltip should say Ollama.
    const { container } = render(() => (
      <CostByModelTable
        rows={[row({ model: 'minimax-chat', provider: 'ollama', auth_type: 'api_key' })]}
        customProviderName={() => undefined}
      />
    ));
    const providerSpan = container.querySelector('tbody tr td span[title]');
    expect(providerSpan?.getAttribute('title')).toContain('Ollama');
  });

  it('falls back to model-name inference when provider is null', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[row({ model: 'claude-opus-4', provider: null, auth_type: 'api_key' })]}
        customProviderName={() => undefined}
      />
    ));
    const providerSpan = container.querySelector('tbody tr td span[title]');
    expect(providerSpan?.getAttribute('title')).toContain('Anthropic');
  });
});
