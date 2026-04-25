import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import type { MessageRow } from '../../src/components/message-table-types';
import { COMPACT_COLUMNS, DETAILED_COLUMNS } from '../../src/components/message-table-types';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock('../../src/services/formatters.js', () => ({
  formatCost: (v: number) => (v < 0 ? null : `$${v.toFixed(2)}`),
  formatNumber: (v: number) => String(v),
  formatStatus: (s: string) => s,
  formatTime: (t: string) => t,
  formatDuration: (ms: number) => `${ms}ms`,
  formatErrorMessage: (s: string) => s,
  customProviderColor: () => '#6366f1',
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  inferProviderFromModel: (m: string) => {
    if (m.startsWith('gpt')) return 'openai';
    if (m.startsWith('claude')) return 'anthropic';
    if (m.startsWith('custom:')) return 'custom';
    // Mirror the real heuristic: tagless Ollama models have a colon
    if (!m.includes('/') && /:/.test(m)) return 'ollama';
    if (m.startsWith('deepseek-')) return 'deepseek';
    return null;
  },
  inferProviderName: (m: string) => {
    if (m.startsWith('gpt')) return 'OpenAI';
    if (m.startsWith('claude')) return 'Anthropic';
    return m;
  },
  resolveProviderId: (dbProvider: string) => {
    if (!dbProvider) return undefined;
    // Mirror the real helper: custom:<uuid> is returned unchanged so the
    // caller can bucket per-custom-provider.
    if (dbProvider.startsWith('custom:')) return dbProvider;
    const map: Record<string, string> = {
      openai: 'openai',
      anthropic: 'anthropic',
      'ollama-cloud': 'ollama-cloud',
      ollama: 'ollama',
    };
    return map[dbProvider.toLowerCase()];
  },
  stripCustomPrefix: (m: string) => m.replace(/^custom:[^/]+\//, ''),
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'ollama-cloud', name: 'Ollama Cloud' },
    { id: 'ollama', name: 'Ollama' },
  ],
}));

vi.mock('../../src/services/model-display.js', () => ({
  getModelDisplayName: (slug: string) => slug,
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (id: string) => <span data-testid={`icon-${id}`} />,
  customProviderLogo: () => null,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: (authType: string | null | undefined) =>
    authType ? <span data-testid={`auth-${authType}`} /> : null,
  authLabel: (authType: string | null | undefined) =>
    authType === 'subscription' ? 'Subscription' : 'API Key',
}));

vi.mock('../../src/components/InfoTooltip.jsx', () => ({
  default: (props: any) => <span data-testid="info-tooltip" title={props.text} />,
}));

vi.mock('../../src/components/MessageDetails.jsx', () => ({
  default: (props: any) => <div data-testid="message-details" data-id={props.messageId} />,
}));

import MessageTable from '../../src/components/MessageTable';

function makeRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'abc12345-6789',
    timestamp: '2026-02-16 10:00:00',
    agent_name: 'test-agent',
    model: 'gpt-4o',
    input_tokens: 100,
    output_tokens: 50,
    total_tokens: 150,
    cost: 0.05,
    status: 'ok',
    ...overrides,
  };
}

const noopProvider = () => undefined;

describe('MessageTable', () => {
  describe('column configuration', () => {
    it('renders compact column headers', () => {
      const { container } = render(() => (
        <MessageTable
          items={[]}
          columns={COMPACT_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const headers = container.querySelectorAll('th');
      expect(headers.length).toBe(7);
      expect(headers[0]!.textContent).toBe('');
      expect(headers[1]!.textContent).toContain('Date');
      expect(headers[2]!.textContent).toContain('Model');
      expect(headers[3]!.textContent).toContain('Message');
      expect(headers[4]!.textContent).toContain('Cost');
      expect(headers[5]!.textContent).toContain('Tokens');
      expect(headers[6]!.textContent).toContain('Status');
    });

    it('renders detailed column headers with tooltips', () => {
      const { container } = render(() => (
        <MessageTable
          items={[]}
          columns={DETAILED_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
          showHeaderTooltips
        />
      ));
      const headers = container.querySelectorAll('th');
      expect(headers.length).toBe(11);
      expect(headers[0]!.textContent).toBe('');
      expect(headers[1]!.textContent).toContain('Date');
      expect(headers[2]!.textContent).toContain('Model');
      expect(headers[3]!.textContent).toContain('Message');
      expect(headers[5]!.textContent).toContain('Total Tokens');
      expect(headers[8]!.textContent).toContain('Cache');
      expect(headers[9]!.textContent).toContain('Latency');
      expect(headers[10]!.textContent).toContain('Status');
      // Tooltips should be present for token columns
      const tooltips = container.querySelectorAll('[data-testid="info-tooltip"]');
      expect(tooltips.length).toBeGreaterThanOrEqual(3);
    });

    it('renders "Tokens" without tooltip when showHeaderTooltips is false', () => {
      const { container } = render(() => (
        <MessageTable
          items={[]}
          columns={COMPACT_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const tokensHeader = container.querySelectorAll('th')[5]!; // 'totalTokens' is at index 5 in COMPACT_COLUMNS
      expect(tokensHeader.textContent).toBe('Tokens');
      expect(tokensHeader.querySelector('[data-testid="info-tooltip"]')).toBeNull();
    });

    it('renders same number of columns for each row as headers', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={DETAILED_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
          showHeaderTooltips
        />
      ));
      const headers = container.querySelectorAll('th');
      const cells = container.querySelectorAll('tbody td');
      expect(cells.length).toBe(headers.length);
    });
  });

  describe('data rendering', () => {
    it('renders date cell', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('2026-02-16 10:00:00');
    });

    it('renders message ID (first 8 chars)', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ id: 'e83a3049-xxxx' })]}
          columns={['message']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('e83a3049');
    });

    it('renders heartbeat icon when routing_reason is heartbeat', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ routing_reason: 'heartbeat' })]}
          columns={['message']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const heartbeat = container.querySelector('[title="Heartbeat"]');
      expect(heartbeat).toBeDefined();
      expect(heartbeat).not.toBeNull();
    });

    it('renders cost value', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ cost: 1.5 })]}
          columns={['cost']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('$1.50');
    });

    it('renders subscription cost as $0.00', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ auth_type: 'subscription', cost: 0.05 })]}
          columns={['cost']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('$0.00');
    });

    it('renders em dash for null cost', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ cost: null })]}
          columns={['cost']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('\u2014');
    });

    it('renders total tokens', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ total_tokens: 1500 })]}
          columns={['totalTokens']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('1500');
    });

    it('renders input and output tokens', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ input_tokens: 200, output_tokens: 80 })]}
          columns={['input', 'output']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('200');
      expect(container.textContent).toContain('80');
    });

    it('renders cache tokens', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ cache_read_tokens: 500, cache_creation_tokens: 100 })]}
          columns={['cache']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('Read: 500');
      expect(container.textContent).toContain('Write: 100');
    });

    it('renders em dash for zero cache tokens', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ cache_read_tokens: 0, cache_creation_tokens: 0 })]}
          columns={['cache']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('\u2014');
    });

    it('renders duration', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ duration_ms: 450 })]}
          columns={['duration']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('450ms');
    });
  });

  describe('model column', () => {
    it('renders known provider icon and model name', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ model: 'gpt-4o' })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.querySelector('[data-testid="icon-openai"]')).not.toBeNull();
      expect(container.textContent).toContain('gpt-4o');
    });

    it('uses getModelDisplayName over display_name', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ model: 'gpt-4o', display_name: 'GPT-4o' })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      // getModelDisplayName is mocked to strip custom prefix; for gpt-4o it returns as-is
      expect(container.textContent).toContain('gpt-4o');
    });

    it('uses stored provider over model-name inference for ollama-cloud tagged models', () => {
      const { container } = render(() => (
        <MessageTable
          items={[
            makeRow({ id: 'm1', model: 'gemma4:31b', provider: 'ollama-cloud' }),
            makeRow({ id: 'm2', model: 'deepseek-v3.2', provider: 'ollama-cloud' }),
            makeRow({ id: 'm3', model: 'kimi-k2:1t', provider: 'ollama-cloud' }),
          ]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      // All three rows should render the ollama-cloud icon, not ollama (colon
      // heuristic) or deepseek (prefix match).
      const cloudIcons = container.querySelectorAll('[data-testid="icon-ollama-cloud"]');
      expect(cloudIcons.length).toBe(3);
      expect(container.querySelector('[data-testid="icon-ollama"]')).toBeNull();
      expect(container.querySelector('[data-testid="icon-deepseek"]')).toBeNull();
    });

    it('falls back to model-name inference when provider field is absent (legacy rows)', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ model: 'gpt-4o', provider: null })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.querySelector('[data-testid="icon-openai"]')).not.toBeNull();
    });

    it('renders the custom avatar when the stored provider is a custom:<id> prefix', () => {
      // Regression guard: a row with stored provider = 'custom:abc' and
      // model = 'custom:abc/my-model' must render the custom letter avatar,
      // NOT the generic provider-icon branch. Without the isCustomProvider
      // check, provId becomes 'custom:abc' (from resolveProviderId) which
      // does not equal 'custom', so the custom branch would be skipped.
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ model: 'custom:abc/my-model', provider: 'custom:abc' })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={() => 'MyProvider'}
        />
      ));
      const avatar = container.querySelector('.provider-card__logo-letter');
      expect(avatar).not.toBeNull();
      expect(avatar!.textContent).toBe('M');
    });

    it('renders custom provider letter avatar', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ model: 'custom:abc/my-model' })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={() => 'MyProvider'}
        />
      ));
      const avatar = container.querySelector('.provider-card__logo-letter');
      expect(avatar).not.toBeNull();
      expect(avatar!.textContent).toBe('M');
    });

    it('renders em dash for null model', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ model: null })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.textContent).toContain('\u2014');
    });

    it('renders routing tier badge', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ routing_tier: 'fast' })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const badge = container.querySelector('.tier-badge--fast');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('fast');
    });

    it('renders specificity category badge (with underscores replaced) over tier badge', () => {
      const { container } = render(() => (
        <MessageTable
          items={[
            makeRow({
              routing_tier: 'fast',
              specificity_category: 'data_analysis',
            }),
          ]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const specBadge = container.querySelector('.tier-badge--specificity');
      expect(specBadge).not.toBeNull();
      // underscores replaced with spaces
      expect(specBadge!.textContent).toBe('data analysis');
      // When specificity is set, the tier badge is NOT rendered alongside it.
      expect(container.querySelector('.tier-badge--fast')).toBeNull();
    });

    it('renders fallback badge', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ fallback_from_model: 'claude-opus-4-6' })]}
          columns={['model']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const badge = container.querySelector('.tier-badge--fallback');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('fallback');
    });
  });

  describe('status column', () => {
    it('renders success status badge', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ status: 'ok' })]}
          columns={['status']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.querySelector('.status-badge--ok')).not.toBeNull();
    });

    it('renders rate_limited status with link', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ status: 'rate_limited' })]}
          columns={['status']}
          agentName="my-agent"
          customProviderName={noopProvider}
        />
      ));
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toContain('/agents/my-agent/limits');
    });

    it('renders error tooltip for error messages', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ status: 'error', error_message: 'timeout' })]}
          columns={['status']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const tooltip = container.querySelector('.status-badge-tooltip');
      expect(tooltip).not.toBeNull();
      expect(tooltip!.getAttribute('aria-label')).toBe('timeout');
    });

    it('renders fallback_error with SVG icon', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ status: 'fallback_error', error_message: 'rate limited' })]}
          columns={['status']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const badge = container.querySelector('.status-badge--fallback_error');
      expect(badge).not.toBeNull();
      expect(badge!.querySelector('svg')).not.toBeNull();
    });

    it('renders separate SVG icons for multiple fallback_error rows', () => {
      const { container } = render(() => (
        <MessageTable
          items={[
            makeRow({ id: 'row-1', status: 'fallback_error', error_message: 'err 1' }),
            makeRow({ id: 'row-2', status: 'fallback_error', error_message: 'err 2' }),
          ]}
          columns={['status']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const badges = container.querySelectorAll('.status-badge--fallback_error');
      expect(badges.length).toBe(2);
      const svg1 = badges[0]!.querySelector('svg');
      const svg2 = badges[1]!.querySelector('svg');
      expect(svg1).not.toBeNull();
      expect(svg2).not.toBeNull();
      // Each row has its own SVG node (not the same DOM element)
      expect(svg1).not.toBe(svg2);
    });

    it('calls onFallbackErrorClick when fallback_error badge is clicked', () => {
      const handler = vi.fn();
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ status: 'fallback_error', error_message: 'err', model: 'gpt-4o' })]}
          columns={['status']}
          agentName="agent-1"
          customProviderName={noopProvider}
          onFallbackErrorClick={handler}
        />
      ));
      const badge = container.querySelector('.status-badge--fallback_error') as HTMLElement;
      fireEvent.click(badge);
      expect(handler).toHaveBeenCalledWith('gpt-4o');
    });
  });

  describe('row configuration', () => {
    it('sets row id with rowIdPrefix', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ id: 'test-id-123' })]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
          rowIdPrefix="msg-"
        />
      ));
      const row = container.querySelector('tr[id="msg-test-id-123"]');
      expect(row).not.toBeNull();
    });

    it('does not set row id when rowIdPrefix is omitted', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const bodyRow = container.querySelector('tbody tr');
      expect(bodyRow!.getAttribute('id')).toBeNull();
    });
  });

  describe('expand details', () => {
    it('renders chevron button for each row when expandable', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow(), makeRow({ id: 'row-2' })]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
          expandable
        />
      ));
      const buttons = container.querySelectorAll('.msg-detail__chevron-btn');
      expect(buttons.length).toBe(2);
    });

    it('does not render chevron when expandable is false', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.querySelector('.msg-detail__chevron-btn')).toBeNull();
      expect(container.querySelector('.msg-detail__chevron-th')).toBeNull();
    });

    it('expands details panel when chevron is clicked', async () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
          expandable
        />
      ));
      expect(container.querySelector('[data-testid="message-details"]')).toBeNull();
      const btn = container.querySelector('.msg-detail__chevron-btn') as HTMLButtonElement;
      fireEvent.click(btn);
      expect(container.querySelector('[data-testid="message-details"]')).not.toBeNull();
    });

    it('collapses details panel on second click', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
          expandable
        />
      ));
      const btn = container.querySelector('.msg-detail__chevron-btn') as HTMLButtonElement;
      fireEvent.click(btn);
      expect(container.querySelector('[data-testid="message-details"]')).not.toBeNull();
      fireEvent.click(btn);
      expect(container.querySelector('[data-testid="message-details"]')).toBeNull();
    });

    it('adds open class to chevron button when expanded', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
          expandable
        />
      ));
      const btn = container.querySelector('.msg-detail__chevron-btn') as HTMLElement;
      expect(btn.classList.contains('msg-detail__chevron-btn--open')).toBe(false);
      fireEvent.click(btn);
      expect(btn.classList.contains('msg-detail__chevron-btn--open')).toBe(true);
    });

    it('passes correct messageId to MessageDetails', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ id: 'specific-msg-id' })]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
          expandable
        />
      ));
      const btn = container.querySelector('.msg-detail__chevron-btn') as HTMLButtonElement;
      fireEvent.click(btn);
      const details = container.querySelector('[data-testid="message-details"]');
      expect(details).not.toBeNull();
      expect(details!.getAttribute('data-id')).toBe('specific-msg-id');
    });

    it('sets aria-label on chevron button', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['date']}
          agentName="agent-1"
          customProviderName={noopProvider}
          expandable
        />
      ));
      const btn = container.querySelector('.msg-detail__chevron-btn') as HTMLElement;
      expect(btn.getAttribute('aria-label')).toBe('Expand details');
      fireEvent.click(btn);
      expect(btn.getAttribute('aria-label')).toBe('Collapse details');
    });
  });

  describe('consistency guarantees', () => {
    it('compact and detailed columns render identical model cell for same data', () => {
      const row = makeRow({ model: 'gpt-4o', display_name: 'GPT-4o', routing_tier: 'fast' });

      const { container: compact } = render(() => (
        <MessageTable
          items={[row]}
          columns={COMPACT_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const { container: detailed } = render(() => (
        <MessageTable
          items={[row]}
          columns={DETAILED_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
          showHeaderTooltips
        />
      ));

      // Both should show the same model text
      const compactModel = compact.querySelector('.tier-badge--fast');
      const detailedModel = detailed.querySelector('.tier-badge--fast');
      expect(compactModel).not.toBeNull();
      expect(detailedModel).not.toBeNull();
      expect(compactModel!.textContent).toBe(detailedModel!.textContent);
    });

    it('compact and detailed columns render identical status cell for same data', () => {
      const row = makeRow({ status: 'error', error_message: 'timeout' });

      const { container: compact } = render(() => (
        <MessageTable
          items={[row]}
          columns={COMPACT_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const { container: detailed } = render(() => (
        <MessageTable
          items={[row]}
          columns={DETAILED_COLUMNS}
          agentName="agent-1"
          customProviderName={noopProvider}
          showHeaderTooltips
        />
      ));

      const compactTooltip = compact.querySelector('.status-badge-tooltip');
      const detailedTooltip = detailed.querySelector('.status-badge-tooltip');
      expect(compactTooltip!.getAttribute('aria-label')).toBe(
        detailedTooltip!.getAttribute('aria-label'),
      );
    });

    it('supports custom column subsets for future pages', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ duration_ms: 300 })]}
          columns={['date', 'cost', 'totalTokens', 'duration', 'status']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      const headers = container.querySelectorAll('th');
      expect(headers.length).toBe(5);
      expect(headers[0]!.textContent).toContain('Date');
      expect(headers[1]!.textContent).toContain('Cost');
      expect(headers[2]!.textContent).toContain('Tokens');
      expect(headers[3]!.textContent).toContain('Latency');
      expect(headers[4]!.textContent).toContain('Status');
    });
  });

  describe('feedback column', () => {
    it('renders feedback buttons', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
          onFeedbackLike={vi.fn()}
          onFeedbackDislike={vi.fn()}
          onFeedbackClear={vi.fn()}
        />
      ));
      const buttons = container.querySelectorAll('.feedback-btn');
      expect(buttons.length).toBe(2);
    });

    it('calls onFeedbackLike when thumb up is clicked', () => {
      const handler = vi.fn();
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ id: 'msg-like-test' })]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
          onFeedbackLike={handler}
          onFeedbackDislike={vi.fn()}
          onFeedbackClear={vi.fn()}
        />
      ));
      const likeBtn = container.querySelectorAll('.feedback-btn')[0] as HTMLElement;
      fireEvent.click(likeBtn);
      expect(handler).toHaveBeenCalledWith('msg-like-test');
    });

    it('calls onFeedbackDislike when thumb down is clicked', () => {
      const handler = vi.fn();
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ id: 'msg-dislike-test' })]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
          onFeedbackLike={vi.fn()}
          onFeedbackDislike={handler}
          onFeedbackClear={vi.fn()}
        />
      ));
      const dislikeBtn = container.querySelectorAll('.feedback-btn')[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      expect(handler).toHaveBeenCalledWith('msg-dislike-test');
    });

    it('calls onFeedbackClear when active like is clicked again', () => {
      const handler = vi.fn();
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ id: 'msg-clear-test', feedback_rating: 'like' })]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
          onFeedbackLike={vi.fn()}
          onFeedbackDislike={vi.fn()}
          onFeedbackClear={handler}
        />
      ));
      const likeBtn = container.querySelector('.feedback-btn--active-like') as HTMLElement;
      expect(likeBtn).not.toBeNull();
      fireEvent.click(likeBtn);
      expect(handler).toHaveBeenCalledWith('msg-clear-test');
    });

    it('calls onFeedbackClear when active dislike is clicked again', () => {
      const handler = vi.fn();
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ id: 'msg-clear-test', feedback_rating: 'dislike' })]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
          onFeedbackLike={vi.fn()}
          onFeedbackDislike={vi.fn()}
          onFeedbackClear={handler}
        />
      ));
      const dislikeBtn = container.querySelector('.feedback-btn--active-dislike') as HTMLElement;
      expect(dislikeBtn).not.toBeNull();
      fireEvent.click(dislikeBtn);
      expect(handler).toHaveBeenCalledWith('msg-clear-test');
    });

    it('shows active-like class when feedback_rating is like', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ feedback_rating: 'like' })]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.querySelector('.feedback-btn--active-like')).not.toBeNull();
      expect(container.querySelector('.feedback-btn--active-dislike')).toBeNull();
    });

    it('shows active-dislike class when feedback_rating is dislike', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow({ feedback_rating: 'dislike' })]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.querySelector('.feedback-btn--active-dislike')).not.toBeNull();
      expect(container.querySelector('.feedback-btn--active-like')).toBeNull();
    });

    it('shows no active class when no feedback', () => {
      const { container } = render(() => (
        <MessageTable
          items={[makeRow()]}
          columns={['feedback']}
          agentName="agent-1"
          customProviderName={noopProvider}
        />
      ));
      expect(container.querySelector('.feedback-btn--active-like')).toBeNull();
      expect(container.querySelector('.feedback-btn--active-dislike')).toBeNull();
    });
  });
});
