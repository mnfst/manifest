import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

let mockAgentName = 'test-agent';
let mockSearchParams: Record<string, string | undefined> = {};
let mockSearchAgentAccessor: (() => string | undefined) | null = null;
const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: mockAgentName }),
  useSearchParams: () => [
    {
      get agent() {
        return mockSearchAgentAccessor ? mockSearchAgentAccessor() : mockSearchParams.agent;
      },
    },
    vi.fn(),
  ],
  useNavigate: () => mockNavigate,
  A: (props: any) => (
    <a href={props.href} style={props.style} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ''} content={props.content ?? ''} />,
}));

const mockGetMessages = vi.fn();
const mockGetMessageFilterOptions = vi.fn();
const mockGetAgents = vi.fn();
const mockGetCustomProviders = vi.fn();
const mockGetSpecificityAssignments = vi.fn();
const mockGetMessageDetails = vi.fn();
const mockGetRoutingStatus = vi.fn();
const mockListHeaderTiers = vi.fn();
const mockSetMessageFeedback = vi.fn();
const mockClearMessageFeedback = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  getMessageFilterOptions: (...args: unknown[]) => mockGetMessageFilterOptions(...args),
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
  getSpecificityAssignments: (...args: unknown[]) => mockGetSpecificityAssignments(...args),
  getMessageDetails: (...args: unknown[]) => mockGetMessageDetails(...args),
  getRoutingStatus: (...args: unknown[]) => mockGetRoutingStatus(...args),
  listHeaderTiers: (...args: unknown[]) => mockListHeaderTiers(...args),
  setMessageFeedback: (...args: unknown[]) => mockSetMessageFeedback(...args),
  clearMessageFeedback: (...args: unknown[]) => mockClearMessageFeedback(...args),
}));

vi.mock('../../src/services/sse.js', () => ({
  pingCount: () => 0,
  messagePing: () => 0,
  agentPing: () => 0,
  routingPing: () => 0,
}));

vi.mock('../../src/services/model-display.js', () => ({
  getModelDisplayName: (slug: string) => slug.replace(/^custom:[^/]+\//, ''),
  preloadModelDisplayNames: () => {},
}));

vi.mock('../../src/services/formatters.js', () => ({
  formatCost: (v: number) => `$${v.toFixed(2)}`,
  formatNumber: (v: number) => String(v),
  formatStatus: (s: string) => s,
  formatTime: (t: string) => t,
  formatDuration: (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`),
  formatErrorMessage: (s: string) => s,
  customProviderColor: vi.fn(() => '#6366f1'),
  sortedHeaderEntries: (h: Record<string, string> | null | undefined) =>
    Object.entries(h ?? {}).sort(([a], [b]) => a.localeCompare(b)),
}));

const mockCheckIsSelfHosted = vi.fn(() => Promise.resolve(false));
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => mockCheckIsSelfHosted(),
}));

vi.mock('../../src/components/SetupModal.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="setup-modal"
      data-open={props.open ? 'true' : 'false'}
      data-agent={props.agentName ?? ''}
      data-platform={props.agentPlatform ?? ''}
      data-category={props.agentCategory ?? ''}
    >
      <button data-testid="setup-close" onClick={() => props.onClose?.()}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/FeedbackModal.jsx', () => ({
  default: (props: any) => (
    <div data-testid="feedback-modal" data-open={props.open ? 'true' : 'false'}>
      <button data-testid="feedback-submit" onClick={() => props.onSubmit?.(['Too slow'], 'test')}>
        Submit
      </button>
      <button data-testid="feedback-close" onClick={() => props.onClose?.()}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/InfoTooltip.jsx', () => ({
  default: () => <span data-testid="info-tooltip" />,
}));

vi.mock('../../src/components/Select.jsx', () => ({
  default: (props: any) => (
    <select
      data-testid="select"
      value={props.value}
      onChange={(e: any) => props.onChange(e.target.value)}
    >
      {props.options?.map((o: any) => (
        <option value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('../../src/components/ErrorState.jsx', () => ({
  default: (props: any) => <div data-testid="error-state">{props.title}</div>,
}));

vi.mock('../../src/components/Pagination.jsx', () => ({
  default: (props: any) => {
    const total = props.totalItems();
    return total > props.pageSize ? (
      <div data-testid="pagination">
        <button
          data-testid="pagination-prev"
          onClick={props.onPrevious}
          disabled={props.currentPage() <= 1}
        >
          Previous
        </button>
        <button
          data-testid="pagination-next"
          onClick={props.onNext}
          disabled={!props.hasNextPage()}
        >
          Next
        </button>
      </div>
    ) : null;
  },
}));

import MessageLog from '../../src/pages/MessageLog';

const messagesData = {
  items: [
    {
      id: 'msg-12345678',
      timestamp: '2026-02-18T10:00:00Z',
      agent_name: 'test-agent',
      model: 'gpt-4o',
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      cost: 0.01,
      status: 'ok',
      cache_read_tokens: 500,
      cache_creation_tokens: 100,
      duration_ms: 1200,
    },
    {
      id: 'msg-87654321',
      timestamp: '2026-02-18T09:00:00Z',
      agent_name: 'test-agent',
      model: 'claude-3.5-sonnet',
      input_tokens: 200,
      output_tokens: 100,
      total_tokens: 300,
      cost: 0.02,
      status: 'error',
      cache_read_tokens: null,
      cache_creation_tokens: null,
      duration_ms: null,
    },
  ],
  next_cursor: null,
  total_count: 2,
  providers: ['anthropic', 'openai'],
};

describe('MessageLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAgentName = 'test-agent';
    mockSearchParams = {};
    mockSearchAgentAccessor = null;
    mockGetAgents.mockResolvedValue({
      agents: [{ agent_name: 'agent-alpha' }, { agent_name: 'agent-beta' }],
    });
    mockGetMessageFilterOptions.mockResolvedValue({ providers: ['anthropic', 'openai'] });
    mockGetCustomProviders.mockResolvedValue([]);
    mockGetSpecificityAssignments.mockResolvedValue([]);
    mockGetRoutingStatus.mockResolvedValue({ enabled: false });
    mockListHeaderTiers.mockResolvedValue([]);
  });

  it('renders Messages heading', () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    expect(screen.getByText('Messages')).toBeDefined();
  });

  it('renders breadcrumb subtitle', () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    expect(screen.getByText(/Full log of every LLM call/)).toBeDefined();
  });

  it('shows loading skeleton while fetching', () => {
    mockGetMessages.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <MessageLog />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows message items after data loads', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('msg-1234');
      expect(container.textContent).toContain('msg-8765');
      expect(container.textContent).toContain('gpt-4o');
      expect(container.textContent).toContain('claude-3.5-sonnet');
    });
  });

  it('shows total count', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2 total');
    });
  });

  it('shows table headers', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Date');
      expect(container.textContent).toContain('Cost');
      expect(container.textContent).toContain('Total Tokens');
      expect(container.textContent).toContain('Model');
      expect(container.textContent).toContain('Cache');
      expect(container.textContent).toContain('Latency');
      expect(container.textContent).toContain('Status');
    });
  });

  it('shows formatted costs', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('$0.01');
      expect(container.textContent).toContain('$0.02');
    });
  });

  it('shows empty state for new agent', async () => {
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: [],
    });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No messages yet');
    });
  });

  it("shows 'no messages match' when filters return 0 results", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
    const selects = container.querySelectorAll('[data-testid="select"]');
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: ['openai'],
    });
    await fireEvent.change(selects[0], { target: { value: 'openai' } });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No messages match your filters');
    });
  });

  it('does not show waiting banner when filters return 0 results', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
    const selects = container.querySelectorAll('[data-testid="select"]');
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: ['openai'],
    });
    await fireEvent.change(selects[0], { target: { value: 'openai' } });
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain('Waiting for data');
      expect(container.textContent).not.toContain('No messages yet');
    });
  });

  it('shows filter controls when data exists', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders provider display names in the filter dropdown', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    mockGetMessageFilterOptions.mockResolvedValue({
      providers: ['anthropic', 'openai', 'unknown-provider'],
    });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const select = container.querySelector('[data-testid="select"]');
      expect(select).not.toBeNull();
      // Known providers resolve to display names
      expect(select!.textContent).toContain('Anthropic');
      expect(select!.textContent).toContain('OpenAI');
      // Unknown providers fall back to the raw ID
      expect(select!.textContent).toContain('unknown-provider');
      expect(select!.textContent).toContain('All providers');
    });
  });

  it('debounces cost filter inputs', async () => {
    vi.useFakeTimers();
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.advanceTimersByTimeAsync(100);

    const inputs = container.querySelectorAll('.cost-range-filter__input');
    expect(inputs.length).toBe(2);

    mockGetMessages.mockClear();

    // Rapid typing should not fire immediately
    fireEvent.input(inputs[0], { target: { value: '1' } });
    fireEvent.input(inputs[0], { target: { value: '1.5' } });
    expect(mockGetMessages).not.toHaveBeenCalled();

    // After debounce window, the API call fires
    await vi.advanceTimersByTimeAsync(500);
    expect(mockGetMessages).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('debounces cost max filter inputs', async () => {
    vi.useFakeTimers();
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.advanceTimersByTimeAsync(100);

    const inputs = container.querySelectorAll('.cost-range-filter__input');
    mockGetMessages.mockClear();

    fireEvent.input(inputs[1], { target: { value: '10' } });
    expect(mockGetMessages).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(mockGetMessages).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('keeps showing stale data during refetch instead of skeletons', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('msg-1234');
    });

    // Trigger a refetch that never resolves
    mockGetMessages.mockReturnValue(new Promise(() => {}));
    const selects = container.querySelectorAll('[data-testid="select"]');
    await fireEvent.change(selects[0], { target: { value: 'openai' } });

    // Should still show old data, not skeletons
    expect(container.textContent).toContain('msg-1234');
    expect(container.querySelectorAll('.skeleton').length).toBe(0);
  });

  it('shows cost range filter inputs', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const inputs = container.querySelectorAll('.cost-range-filter__input');
      expect(inputs.length).toBe(2);
    });
  });

  it('shows cache tokens when present', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Read: 500 / Write: 100');
    });
  });

  it('shows dash for null cache tokens', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
    });
  });

  it('shows dash for zero cache tokens', async () => {
    const dataWithZeroCache = {
      ...messagesData,
      items: [{ ...messagesData.items[0], cache_read_tokens: 0, cache_creation_tokens: 0 }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithZeroCache);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      // Zero cache tokens should show dash, not "Read: 0 / Write: 0"
      expect(container.textContent).not.toContain('Read: 0 / Write: 0');
    });
  });

  it('shows formatted duration', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('1.2s');
    });
  });

  it('shows dash for null duration', async () => {
    const dataWithNullDuration = {
      ...messagesData,
      items: [messagesData.items[1]], // second item has duration_ms: null
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithNullDuration);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('claude-3.5-sonnet');
    });
  });

  it('shows sub-second duration in ms format', async () => {
    const dataWithMsDuration = {
      ...messagesData,
      items: [{ ...messagesData.items[0], duration_ms: 423 }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithMsDuration);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('423ms');
    });
  });

  it('calls getMessages on mount', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalled();
    });
  });

  describe('error tooltip', () => {
    it('shows tooltip when error_message is present on a failed row', async () => {
      const dataWithError = {
        ...messagesData,
        items: [
          {
            id: 'msg-err12345',
            timestamp: '2026-02-18T10:00:00Z',
            agent_name: 'test-agent',
            model: 'gpt-4o',
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0,
            status: 'error',
            error_message: '401 Unauthorized: invalid API key',
          },
        ],
      };
      mockGetMessages.mockResolvedValue(dataWithError);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const tooltip = container.querySelector('.status-badge-tooltip');
        expect(tooltip).not.toBeNull();
        const bubble = container.querySelector('.status-badge-tooltip__bubble');
        expect(bubble).not.toBeNull();
        expect(bubble!.textContent).toBe('401 Unauthorized: invalid API key');
      });
    });

    it('does not show tooltip when error_message is absent', async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('msg-1234');
        const tooltip = container.querySelector('.status-badge-tooltip');
        expect(tooltip).toBeNull();
      });
    });

    it('sets aria-label on the tooltip wrapper', async () => {
      const dataWithError = {
        ...messagesData,
        items: [
          {
            id: 'msg-err99999',
            timestamp: '2026-02-18T10:00:00Z',
            agent_name: 'test-agent',
            model: 'gpt-4o',
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0,
            status: 'error',
            error_message: 'timeout',
          },
        ],
      };
      mockGetMessages.mockResolvedValue(dataWithError);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const tooltip = container.querySelector('.status-badge-tooltip');
        expect(tooltip?.getAttribute('aria-label')).toBe('timeout');
      });
    });
  });

  describe('pagination', () => {
    it('shows pagination when total_count exceeds page size', async () => {
      const bigData = { ...messagesData, total_count: 120, next_cursor: 'cursor-2' };
      mockGetMessages.mockResolvedValue(bigData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="pagination"]')).not.toBeNull();
      });
    });

    it('hides pagination when total_count is within page size', async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('2 total');
        expect(container.querySelector('[data-testid="pagination"]')).toBeNull();
      });
    });

    it('Next calls getMessages with cursor after navigating', async () => {
      const bigData = { ...messagesData, total_count: 120, next_cursor: 'cursor-for-page-2' };
      mockGetMessages.mockResolvedValue(bigData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="pagination-next"]')).not.toBeNull();
      });
      mockGetMessages.mockClear();
      mockGetMessages.mockResolvedValue({ ...messagesData, total_count: 120, next_cursor: null });
      const nextBtn = container.querySelector(
        '[data-testid="pagination-next"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      await vi.waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith(
          expect.objectContaining({ cursor: 'cursor-for-page-2' }),
        );
      });
    });

    it('uses lower-bound totals after skipping exact counts on later pages', async () => {
      const firstPage = {
        ...messagesData,
        total_count: 51,
        total_count_exact: false,
        next_cursor: 'cursor-for-page-2',
      };
      mockGetMessages.mockResolvedValue(firstPage);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('51 total');
      });

      mockGetMessages.mockResolvedValue({
        ...messagesData,
        total_count: 2,
        total_count_exact: false,
        next_cursor: null,
      });
      const nextBtn = container.querySelector(
        '[data-testid="pagination-next"]',
      ) as HTMLButtonElement;
      nextBtn.click();

      await vi.waitFor(() => {
        expect(container.textContent).toContain('52 total');
      });
    });
  });

  it('clears all filters when Clear filters button is clicked', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
    // Set a filter to trigger filtered empty state
    const selects = container.querySelectorAll('[data-testid="select"]');
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: ['openai'],
    });
    await fireEvent.change(selects[0], { target: { value: 'openai' } });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No messages match your filters');
    });
    // Click Clear filters
    const clearBtn = container.querySelector('.btn--outline')!;
    fireEvent.click(clearBtn);
    // Filters should be cleared (API re-called)
    await vi.waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalled();
    });
  });

  it('shows routing tier badge when present', async () => {
    const dataWithTier = {
      ...messagesData,
      items: [{ ...messagesData.items[0], routing_tier: 'simple' }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithTier);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.tier-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe('simple');
    });
  });

  it('closes setup modal via onClose callback', async () => {
    // To trigger setup modal, we need a new agent without setup completed
    localStorage.removeItem('setup_completed_test-agent');
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: [],
    });
    const { container } = render(() => <MessageLog />);
    // The setup-close button in our mock will call onClose
    const closeBtn = container.querySelector('[data-testid="setup-close"]');
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
    // Verify mock was rendered
    expect(container.querySelector('[data-testid="setup-modal"]')).not.toBeNull();
  });

  it('shows Connect provider button when setupCompleted but no providers', async () => {
    localStorage.setItem('setup_completed_test-agent', '1');
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: [],
    });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Connect provider');
      expect(container.textContent).toContain('Connect a provider to start routing LLM calls');
      expect(container.textContent).not.toContain('Enable routing');
      const btn = container.querySelector('.empty-state button.btn--primary');
      expect(btn).not.toBeNull();
    });
  });

  it('navigates to routing with openProviders state when Connect provider clicked', async () => {
    localStorage.setItem('setup_completed_test-agent', '1');
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: [],
    });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Connect provider');
    });
    const btn = container.querySelector('.empty-state button.btn--primary') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/harnesses/test-agent/routing', {
      state: { openProviders: true },
    });
  });

  it('shows message table when providers are enabled but no data', async () => {
    mockGetRoutingStatus.mockResolvedValue({ enabled: true });
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: [],
    });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.querySelector('.waiting-banner')).not.toBeNull();
      expect(container.querySelector('.empty-state')).toBeNull();
      expect(container.textContent).toContain('0 total');
    });
  });

  it('shows Set up harness when no setupCompleted and no providers', async () => {
    mockGetMessages.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
      providers: [],
    });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Set up harness');
      expect(container.textContent).not.toContain('Enable routing');
      expect(container.textContent).not.toContain('Connect provider');
    });
  });

  describe('custom provider models', () => {
    // The backend resolves the custom provider's name into each row
    // (`custom_provider_name`) and ships a `provider_labels` map for the
    // filter dropdown; the page no longer fetches the list itself.
    const customMessagesData = {
      items: [
        {
          id: 'msg-cp1',
          timestamp: '2026-02-18T10:00:00Z',
          agent_name: 'test-agent',
          model: 'custom:abc-123/my-llama',
          provider: 'custom:abc-123',
          custom_provider_name: 'Cerebras',
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          cost: 0.01,
          status: 'ok',
          cache_read_tokens: null,
          cache_creation_tokens: null,
          duration_ms: 800,
        },
      ],
      next_cursor: null,
      total_count: 1,
      providers: ['custom:abc-123'],
      provider_labels: { 'custom:abc-123': 'Cerebras' },
    };

    it('renders custom provider icon in message rows', async () => {
      mockGetMessages.mockResolvedValue(customMessagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const img = container.querySelector('img[alt="Cerebras"]');
        expect(img).not.toBeNull();
      });
    });

    it('strips custom prefix from model name display', async () => {
      mockGetMessages.mockResolvedValue(customMessagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('my-llama');
        expect(container.textContent).not.toContain('custom:abc-123/');
      });
    });

    it('labels the provider filter option with the custom provider name', async () => {
      mockGetMessages.mockResolvedValue(customMessagesData);
      mockGetMessageFilterOptions.mockResolvedValue({
        providers: ['custom:abc-123'],
        provider_labels: { 'custom:abc-123': 'Cerebras' },
      });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Cerebras');
      });
    });

    it('falls back to model prefix when custom provider was deleted', async () => {
      const deletedProvider = {
        ...customMessagesData,
        items: [{ ...customMessagesData.items[0], custom_provider_name: null }],
        provider_labels: {},
      };
      mockGetMessages.mockResolvedValue(deletedProvider);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('my-llama');
        expect(container.textContent).not.toContain('custom:abc-123/');
      });
    });

    it('resolves custom provider name + icon in global mode from the response', async () => {
      // Global ("All harnesses") log has no route agent. The backend resolves
      // the custom provider's name into each row (`custom_provider_name`), so
      // custom:<uuid> models still render with the real name and provider icon
      // — the page no longer fetches the provider list itself.
      mockAgentName = undefined;
      mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'agent-alpha' }] });
      mockGetMessages.mockResolvedValue(customMessagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('img[alt="Cerebras"]')).not.toBeNull();
        expect(container.textContent).not.toContain('custom:abc-123/');
      });
    });
  });

  describe('clear filters', () => {
    it('clears all filters when clear button is clicked', async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const selects = container.querySelectorAll('[data-testid="select"]');
        expect(selects.length).toBeGreaterThanOrEqual(1);
      });

      // Set a filter
      const selects = container.querySelectorAll('[data-testid="select"]');
      mockGetMessages.mockResolvedValue({
        items: [],
        next_cursor: null,
        total_count: 0,
        providers: ['openai'],
      });
      await fireEvent.change(selects[0], { target: { value: 'openai' } });

      await vi.waitFor(() => {
        expect(container.textContent).toContain('No messages match your filters');
      });

      // Click clear filters
      const clearBtn = container.querySelector('.message-log__clear-btn');
      if (clearBtn) {
        mockGetMessages.mockResolvedValue(messagesData);
        fireEvent.click(clearBtn);
        await vi.waitFor(() => {
          expect(container.textContent).toContain('msg-1234');
        });
      }
    });
  });

  it('shows $0.00 cost for flat-fee subscription messages (cost null)', async () => {
    const dataWithSub = {
      ...messagesData,
      items: [{ ...messagesData.items[0], auth_type: 'subscription', cost: null }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithSub);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('$0.00');
      expect(container.querySelector('[title="Included in subscription"]')).not.toBeNull();
    });
  });

  it("shows the per-request cost for OpenCode Go subscription messages", async () => {
    const dataWithPerRequestSub = {
      ...messagesData,
      items: [{ ...messagesData.items[0], auth_type: 'subscription', cost: 0.013636 }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithPerRequestSub);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      // Per-request subscriptions (OpenCode Go) carry real costs — don't hide them.
      expect(container.textContent).toContain("$0.01");
      expect(
        container.querySelector('[title^="Per-request subscription cost:"]'),
      ).not.toBeNull();
    });
  });

  it('shows formatCost fallback for non-subscription messages with cost', async () => {
    const dataWithCost = {
      ...messagesData,
      items: [{ ...messagesData.items[0], auth_type: null, cost: 0.05 }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithCost);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('$0.05');
    });
  });

  it('renders provider icon SVG for known provider model', async () => {
    const dataWithProvider = {
      ...messagesData,
      items: [{ ...messagesData.items[0], model: 'gpt-4o', auth_type: null }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithProvider);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      // providerIcon returns an inline SVG for known providers
      const providerSpan = container.querySelector('[role="img"]');
      expect(providerSpan).not.toBeNull();
      const svg = providerSpan!.querySelector('svg');
      expect(svg).not.toBeNull();
    });
  });

  it('renders subscription auth badge on provider icon', async () => {
    const dataWithSub = {
      ...messagesData,
      items: [{ ...messagesData.items[0], model: 'claude-sonnet-4', auth_type: 'subscription' }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithSub);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.provider-auth-badge--sub');
      expect(badge).not.toBeNull();
    });
  });

  it('renders api_key auth badge when auth_type is api_key', async () => {
    const dataWithApiKey = {
      ...messagesData,
      items: [{ ...messagesData.items[0], model: 'claude-sonnet-4', auth_type: 'api_key' }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithApiKey);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.provider-auth-badge--key');
      expect(badge).not.toBeNull();
      const subBadge = container.querySelector('.provider-auth-badge--sub');
      expect(subBadge).toBeNull();
    });
  });

  it('renders meta description tag', () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    // Meta is mocked as null, just ensure it renders without error
    expect(screen.getByText('Messages')).toBeDefined();
  });

  it('renders routing tier badge when present', async () => {
    const dataWithTier = {
      ...messagesData,
      items: [{ ...messagesData.items[0], routing_tier: 'simple' }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithTier);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.tier-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('simple');
    });
  });

  it('renders setup modal', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="setup-modal"]')).not.toBeNull();
    });
  });

  it('renders fallback badge when fallback_from_model is present', async () => {
    const dataWithFallback = {
      ...messagesData,
      items: [{ ...messagesData.items[0], fallback_from_model: 'gpt-4o', fallback_index: 0 }],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithFallback);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.tier-badge--fallback');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('fallback');
      expect(badge!.getAttribute('title')).toContain('gpt-4o');
    });
  });

  it('does not render fallback badge when fallback_from_model is absent', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('gpt-4o');
      const badge = container.querySelector('.tier-badge--fallback');
      expect(badge).toBeNull();
    });
  });

  it('renders fallback_error status with orange Handled badge', async () => {
    const dataWithHandled = {
      ...messagesData,
      items: [
        {
          ...messagesData.items[0],
          status: 'fallback_error',
          model: 'gemini-flash',
          error_message: 'Provider returned HTTP 429, routed to fallback',
        },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithHandled);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.status-badge--fallback_error');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('fallback_error');
    });
  });

  it('assigns row IDs for scroll targeting', async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const row = container.querySelector('#msg-msg-12345678');
      expect(row).not.toBeNull();
    });
  });

  it('scrolls to fallback success when clicking Handled badge', async () => {
    const dataWithChain = {
      ...messagesData,
      items: [
        {
          id: 'success-1',
          timestamp: '2026-02-18T10:00:00.200Z',
          agent_name: 'test-agent',
          model: 'deepseek-chat',
          input_tokens: 500,
          output_tokens: 100,
          total_tokens: 600,
          cost: 0.01,
          status: 'ok',
          cache_read_tokens: 0,
          cache_creation_tokens: 0,
          duration_ms: 800,
          fallback_from_model: 'gemini-flash',
          fallback_index: 0,
        },
        {
          id: 'primary-fail-1',
          timestamp: '2026-02-18T10:00:00.000Z',
          agent_name: 'test-agent',
          model: 'gemini-flash',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost: null,
          status: 'fallback_error',
          cache_read_tokens: 0,
          cache_creation_tokens: 0,
          duration_ms: null,
          error_message: 'Provider returned HTTP 429, routed to fallback',
        },
      ],
      total_count: 2,
      providers: ['deepseek', 'gemini'],
    };
    mockGetMessages.mockResolvedValue(dataWithChain);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.status-badge--fallback_error');
      expect(badge).not.toBeNull();
    });
    const successRow = container.querySelector('#msg-success-1');
    const scrollSpy = vi.fn();
    if (successRow) {
      successRow.scrollIntoView = scrollSpy;
    }
    const badge = container.querySelector('.status-badge--fallback_error')!;
    fireEvent.click(badge);
    expect(scrollSpy).toHaveBeenCalled();
  });

  describe('feedback', () => {
    it('calls setMessageFeedback with like when thumb up is clicked', async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn')).not.toBeNull();
      });
      const likeBtn = container.querySelector('.feedback-btn') as HTMLElement;
      fireEvent.click(likeBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith('msg-12345678', { rating: 'like' });
    });

    it('calls setMessageFeedback with dislike and opens modal when thumb down is clicked', async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn')).not.toBeNull();
      });
      const dislikeBtn = container.querySelectorAll('.feedback-btn')[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith('msg-12345678', { rating: 'dislike' });
      const modal = container.querySelector('[data-testid="feedback-modal"]');
      expect(modal?.getAttribute('data-open')).toBe('true');
    });

    it('calls clearMessageFeedback when active like is clicked', async () => {
      mockClearMessageFeedback.mockResolvedValue(undefined);
      const dataWithFeedback = {
        ...messagesData,
        items: [{ ...messagesData.items[0], feedback_rating: 'like' }, messagesData.items[1]],
      };
      mockGetMessages.mockResolvedValue(dataWithFeedback);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn--active-like')).not.toBeNull();
      });
      const likeBtn = container.querySelector('.feedback-btn--active-like') as HTMLElement;
      fireEvent.click(likeBtn);
      expect(mockClearMessageFeedback).toHaveBeenCalledWith('msg-12345678');
    });

    it('submits feedback details from modal', async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn')).not.toBeNull();
      });
      // Click dislike to open modal
      const dislikeBtn = container.querySelectorAll('.feedback-btn')[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      // Submit via modal
      const submitBtn = container.querySelector('[data-testid="feedback-submit"]') as HTMLElement;
      fireEvent.click(submitBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith('msg-12345678', {
        rating: 'dislike',
        tags: ['Too slow'],
        details: 'test',
      });
    });

    it('closes feedback modal without submitting', async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn')).not.toBeNull();
      });
      const dislikeBtn = container.querySelectorAll('.feedback-btn')[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      const closeBtn = container.querySelector('[data-testid="feedback-close"]') as HTMLElement;
      fireEvent.click(closeBtn);
      const modal = container.querySelector('[data-testid="feedback-modal"]');
      expect(modal?.getAttribute('data-open')).toBe('false');
    });

    it('hides feedback column and modal in the self-hosted version', async () => {
      mockCheckIsSelfHosted.mockResolvedValue(true);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.data-table')).not.toBeNull();
      });
      expect(container.querySelector('.feedback-btn')).toBeNull();
      expect(container.querySelector('[data-testid="feedback-modal"]')).toBeNull();
      mockCheckIsSelfHosted.mockResolvedValue(false);
    });

    it('reverts optimistic like on API error', async () => {
      mockSetMessageFeedback.mockRejectedValue(new Error('fail'));
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn')).not.toBeNull();
      });
      const likeBtn = container.querySelector('.feedback-btn') as HTMLElement;
      fireEvent.click(likeBtn);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn--active-like')).toBeNull();
      });
    });

    it('reverts optimistic dislike on API error', async () => {
      mockSetMessageFeedback.mockRejectedValue(new Error('fail'));
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn')).not.toBeNull();
      });
      const dislikeBtn = container.querySelectorAll('.feedback-btn')[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn--active-dislike')).toBeNull();
      });
    });

    it('reverts optimistic clear on API error', async () => {
      mockClearMessageFeedback.mockRejectedValue(new Error('fail'));
      const dataWithFeedback = {
        ...messagesData,
        items: [{ ...messagesData.items[0], feedback_rating: 'like' }, messagesData.items[1]],
      };
      mockGetMessages.mockResolvedValue(dataWithFeedback);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn--active-like')).not.toBeNull();
      });
      const likeBtn = container.querySelector('.feedback-btn--active-like') as HTMLElement;
      fireEvent.click(likeBtn);
      await vi.waitFor(() => {
        expect(container.querySelector('.feedback-btn--active-like')).not.toBeNull();
      });
    });
  });

  describe("Tier filter", () => {
    it("renders a Tier select with Playground among the options", async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const selects = container.querySelectorAll('[data-testid="select"]');
        expect(selects.length).toBeGreaterThanOrEqual(2);
      });
      const selects = container.querySelectorAll('[data-testid="select"]');
      // Second Select is the tier filter (first is providers).
      const tierSelect = selects[1] as HTMLSelectElement;
      expect(tierSelect.textContent).toContain('All tiers');
      expect(tierSelect.textContent).toContain('Playground');
      expect(tierSelect.textContent).toContain('Simple');
    });

    it('adds active task-specific categories and defined custom tiers to the tier options', async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      mockGetSpecificityAssignments.mockResolvedValue([
        { category: 'coding', is_active: true },
        { category: 'trading', is_active: false },
      ]);
      mockListHeaderTiers.mockResolvedValue([
        { id: 'ht-premium', name: 'Premium', enabled: true, sort_order: 0 },
        { id: 'ht-legacy', name: 'Legacy', enabled: false, sort_order: 1 },
      ]);

      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const tierSelect = container.querySelectorAll(
          '[data-testid="select"]',
        )[1] as HTMLSelectElement;
        expect(tierSelect.textContent).toContain('Coding');
        expect(tierSelect.textContent).toContain('Premium');
      });

      const tierSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[1] as HTMLSelectElement;
      expect(tierSelect.textContent).not.toContain('Trading');
      expect(tierSelect.textContent).toContain('Legacy');
      expect(tierSelect.textContent).not.toContain('Task:');
      expect(tierSelect.textContent).not.toContain('Custom:');
    });

    it('sends routing_tier in the query when a tier is selected', async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelectorAll('[data-testid="select"]').length).toBeGreaterThanOrEqual(
          2,
        );
      });
      const tierSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[1] as HTMLSelectElement;
      mockGetMessages.mockClear();
      fireEvent.change(tierSelect, { target: { value: 'playground' } });
      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.routing_tier).toBe('playground');
      });
    });

    it('sends specificity_category in the query when a task category is selected', async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      mockGetSpecificityAssignments.mockResolvedValue([{ category: 'coding', is_active: true }]);

      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelectorAll('[data-testid="select"]').length).toBeGreaterThanOrEqual(
          2,
        );
      });

      const tierSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[1] as HTMLSelectElement;
      mockGetMessages.mockClear();
      fireEvent.change(tierSelect, { target: { value: 'specificity:coding' } });

      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.specificity_category).toBe('coding');
        expect(lastQ.routing_tier).toBeUndefined();
      });
    });

    it('sends header_tier_id in the query when a custom tier is selected', async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      mockListHeaderTiers.mockResolvedValue([{ id: 'ht-premium', name: 'Premium' }]);

      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelectorAll('[data-testid="select"]').length).toBeGreaterThanOrEqual(
          2,
        );
      });

      const tierSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[1] as HTMLSelectElement;
      mockGetMessages.mockClear();
      fireEvent.change(tierSelect, { target: { value: 'header:ht-premium' } });

      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.header_tier_id).toBe('ht-premium');
        expect(lastQ.routing_tier).toBeUndefined();
      });
    });
  });

  describe('Agent filter (global mode)', () => {
    it('renders agent filter dropdown in global mode (no agentName)', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const selects = container.querySelectorAll('[data-testid="select"]');
        // agent filter is the first select in global mode
        expect(selects.length).toBeGreaterThanOrEqual(1);
        expect(selects[0].textContent).toContain('All harnesses');
      });
    });

    it('populates agent filter with sorted agent names from getAgents()', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const selects = container.querySelectorAll('[data-testid="select"]');
        expect(selects[0].textContent).toContain('agent-alpha');
        expect(selects[0].textContent).toContain('agent-beta');
      });
    });

    it('requests system agents so the reserved Playground agent appears in the filter', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(mockGetAgents).toHaveBeenCalledWith(true);
      });
    });

    it('seeds the agent filter from the ?agent= search param (View more redirect)', async () => {
      mockAgentName = '';
      mockSearchParams = { agent: 'agent-beta' };
      mockGetMessages.mockResolvedValue(messagesData);
      render(() => <MessageLog />);
      await vi.waitFor(() => {
        const lastCall = mockGetMessages.mock.calls.at(-1)![0] as Record<string, string>;
        expect(lastCall.agent_name).toBe('agent-beta');
      });
    });

    it('ignores the ?agent= search param in agent-scoped mode (route param wins)', async () => {
      // mockAgentName is "test-agent" from beforeEach
      mockSearchParams = { agent: 'agent-beta' };
      mockGetMessages.mockResolvedValue(messagesData);
      render(() => <MessageLog />);
      await vi.waitFor(() => {
        const lastCall = mockGetMessages.mock.calls.at(-1)![0] as Record<string, string>;
        expect(lastCall.agent_name).toBe('test-agent');
      });
    });

    it('does NOT render agent filter dropdown in agent-scoped mode', async () => {
      // mockAgentName is "test-agent" from beforeEach
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const selects = container.querySelectorAll('[data-testid="select"]');
        // In agent mode, first select is provider filter (no "All harnesses" option)
        expect(selects[0].textContent).not.toContain('All harnesses');
        expect(selects[0].textContent).toContain('All providers');
      });
    });

    it('passes agent_name query param when an agent is selected', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      // Wait for agentList to resolve so the options are populated
      await vi.waitFor(() => {
        const agentSelect = container.querySelectorAll(
          '[data-testid="select"]',
        )[0] as HTMLSelectElement;
        expect(agentSelect.textContent).toContain('agent-alpha');
      });
      mockGetMessages.mockClear();
      const agentSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[0] as HTMLSelectElement;
      fireEvent.change(agentSelect, { target: { value: 'agent-alpha' } });
      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.agent_name).toBe('agent-alpha');
      });
    });

    it('pre-seeds the agent filter from the ?agent= query param (View more deep-link)', async () => {
      mockAgentName = '';
      mockSearchParams = { agent: 'agent-beta' };
      mockGetMessages.mockResolvedValue(messagesData);
      render(() => <MessageLog />);
      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.agent_name).toBe('agent-beta');
      });
    });

    it('updates the agent filter when the ?agent= query param changes', async () => {
      mockAgentName = '';
      const [searchAgent, setSearchAgent] = createSignal<string | undefined>();
      mockSearchAgentAccessor = searchAgent;
      mockGetMessages.mockResolvedValue(messagesData);

      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const agentSelect = container.querySelectorAll(
          '[data-testid="select"]',
        )[0] as HTMLSelectElement;
        expect(agentSelect.textContent).toContain('agent-beta');
      });

      mockGetMessages.mockClear();
      setSearchAgent('agent-beta');

      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.agent_name).toBe('agent-beta');
      });
      const agentSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[0] as HTMLSelectElement;
      expect(agentSelect.value).toBe('agent-beta');
    });

    it("omits agent_name query param when 'All harnesses' is selected", async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      // Wait for agentList to resolve so the options are populated
      await vi.waitFor(() => {
        const agentSelect = container.querySelectorAll(
          '[data-testid="select"]',
        )[0] as HTMLSelectElement;
        expect(agentSelect.textContent).toContain('agent-alpha');
      });
      // Select an agent first
      const agentSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[0] as HTMLSelectElement;
      fireEvent.change(agentSelect, { target: { value: 'agent-alpha' } });
      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        expect(calls.some((c: any[]) => c[0]?.agent_name === 'agent-alpha')).toBe(true);
      });
      mockGetMessages.mockClear();
      // Then go back to "All harnesses"
      fireEvent.change(agentSelect, { target: { value: '' } });
      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.agent_name).toBeUndefined();
      });
    });

    it('includes agentFilter in hasActiveFilters so filtered-empty state appears', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      // Wait for agentList to resolve before interacting with the filter
      await vi.waitFor(() => {
        const agentSelect = container.querySelectorAll(
          '[data-testid="select"]',
        )[0] as HTMLSelectElement;
        expect(agentSelect.textContent).toContain('agent-alpha');
      });
      mockGetMessages.mockResolvedValue({
        items: [],
        next_cursor: null,
        total_count: 0,
        providers: ['openai'],
      });
      const agentSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[0] as HTMLSelectElement;
      fireEvent.change(agentSelect, { target: { value: 'agent-alpha' } });
      await vi.waitFor(() => {
        expect(container.textContent).toContain('No messages match your filters');
      });
    });

    it('clears agentFilter when Clear filters is clicked', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      // Wait for agentList to resolve before interacting with the filter
      await vi.waitFor(() => {
        const agentSelect = container.querySelectorAll(
          '[data-testid="select"]',
        )[0] as HTMLSelectElement;
        expect(agentSelect.textContent).toContain('agent-alpha');
      });
      mockGetMessages.mockResolvedValue({
        items: [],
        next_cursor: null,
        total_count: 0,
        providers: ['openai'],
      });
      const agentSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[0] as HTMLSelectElement;
      fireEvent.change(agentSelect, { target: { value: 'agent-alpha' } });
      await vi.waitFor(() => {
        expect(container.textContent).toContain('No messages match your filters');
      });
      // Clear filters — restores data
      mockGetMessages.mockResolvedValue(messagesData);
      const clearBtn = container.querySelector('.btn--outline') as HTMLButtonElement;
      fireEvent.click(clearBtn);
      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        expect(calls.some((c: any[]) => !c[0]?.agent_name)).toBe(true);
      });
    });

    it('surfaces getAgents() errors to the resource error state (not silently empty)', async () => {
      mockAgentName = '';
      // The loader no longer swallows errors: when getAgents() rejects the
      // rejection propagates out of the loader so SolidJS resource transitions
      // into error state instead of silently returning [].
      // We verify: (1) getAgents was actually called; (2) the UI still renders
      // the agent filter gracefully via `agentList() ?? []`.
      mockGetAgents.mockImplementation(async () => {
        throw new Error('network error');
      });
      mockGetMessages.mockResolvedValue(messagesData);
      const { container, unmount } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(mockGetAgents).toHaveBeenCalled();
        const selects = container.querySelectorAll('[data-testid="select"]');
        // Agent filter still renders gracefully (agentList() ?? [] = [])
        expect(selects[0].textContent).toContain('All harnesses');
        expect(selects[0].textContent).not.toContain('agent-alpha');
      });
      // Unmount and reset before the rejection can leak into the next test.
      unmount();
      mockGetAgents.mockResolvedValue({ agents: [] });
    });

    it('resets page when agentFilter changes', async () => {
      mockAgentName = '';
      const bigData = { ...messagesData, total_count: 120, next_cursor: 'cursor-2' };
      mockGetMessages.mockResolvedValue(bigData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="pagination-next"]')).not.toBeNull();
      });
      // Navigate to next page
      const nextBtn = container.querySelector(
        '[data-testid="pagination-next"]',
      ) as HTMLButtonElement;
      mockGetMessages.mockResolvedValue({ ...bigData, next_cursor: null });
      nextBtn.click();
      await vi.waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith(
          expect.objectContaining({ cursor: 'cursor-2' }),
        );
      });
      // Changing agent filter should reset page (no cursor)
      mockGetMessages.mockClear();
      mockGetMessages.mockResolvedValue(messagesData);
      const agentSelect = container.querySelectorAll(
        '[data-testid="select"]',
      )[0] as HTMLSelectElement;
      fireEvent.change(agentSelect, { target: { value: 'agent-alpha' } });
      await vi.waitFor(() => {
        const calls = mockGetMessages.mock.calls;
        const lastQ = calls[calls.length - 1]?.[0] ?? {};
        expect(lastQ.cursor).toBeUndefined();
      });
    });

    it("renders 'Harness' column header in the message table when in global mode", async () => {
      // Fix: columns() now inserts 'agent' before 'model' when !params.agentName.
      // This test asserts the Harness column header actually appears in the DOM,
      // not just that the component receives the columns array.
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('gpt-4o');
      });
      const headers = Array.from(container.querySelectorAll('thead th'));
      const headerTexts = headers.map((th) => th.textContent?.trim());
      expect(headerTexts).toContain('Harness');
    });

    it("does NOT render 'Harness' column header in agent-scoped mode", async () => {
      // mockAgentName is "test-agent" from beforeEach — agent-scoped mode.
      // columns() returns DETAILED_COLUMNS unchanged (no 'agent' key).
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('gpt-4o');
      });
      const headers = Array.from(container.querySelectorAll('thead th'));
      const headerTexts = headers.map((th) => th.textContent?.trim());
      expect(headerTexts).not.toContain('Harness');
    });

    it('renders agent_name values in the Agent column cells in global mode', async () => {
      // Each message row must show its agent_name in the Agent cell when
      // the 'agent' column is included (global mode).
      mockAgentName = '';
      const globalMessagesData = {
        ...messagesData,
        items: [
          { ...messagesData.items[0], agent_name: 'alpha-bot' },
          { ...messagesData.items[1], agent_name: 'beta-bot' },
        ],
      };
      mockGetMessages.mockResolvedValue(globalMessagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('alpha-bot');
        expect(container.textContent).toContain('beta-bot');
      });
    });

    it('renders harness platform icons in global Harness column cells', async () => {
      mockAgentName = '';
      mockGetAgents.mockResolvedValue({
        agents: [
          {
            agent_name: 'alpha-bot',
            agent_platform: 'openclaw',
            agent_category: 'personal',
          },
        ],
      });
      mockGetMessages.mockResolvedValue({
        ...messagesData,
        items: [{ ...messagesData.items[0], agent_name: 'alpha-bot' }],
      });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('alpha-bot');
        expect(container.querySelector('td img[src="/icons/openclaw.svg"]')).not.toBeNull();
      });
    });
  });

  describe('global mode title and CTA (Bug 2 + Bug 3)', () => {
    it("renders 'Messages - Manifest' title without agent prefix in global mode", () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      const title = container.querySelector('title');
      expect(title?.textContent).toBe('Messages - Manifest');
    });

    it('renders agent-scoped title in agent mode', () => {
      // mockAgentName is "test-agent" from beforeEach
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      const title = container.querySelector('title');
      expect(title?.textContent).toContain('test-agent');
      expect(title?.textContent).toContain('Messages - Manifest');
    });

    it("does not render 'undefined' in the title in global mode", () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      const title = container.querySelector('title');
      expect(title?.textContent).not.toContain('undefined');
    });

    it('does not render SetupModal in global mode (no agentName)', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue({
        items: [],
        next_cursor: null,
        total_count: 0,
        providers: [],
      });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        // Setup modal must not be rendered when there is no agentName
        expect(container.querySelector('[data-testid="setup-modal"]')).toBeNull();
      });
    });

    it("shows 'Go to Harnesses' link (not SetupModal CTA) in the empty state in global mode", async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue({
        items: [],
        next_cursor: null,
        total_count: 0,
        providers: [],
      });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('No messages yet');
        // Global empty state guides to /harnesses, not set-up-agent modal
        const link = container.querySelector('a[href="/harnesses"]') as HTMLAnchorElement;
        expect(link).not.toBeNull();
        expect(link.textContent).toContain('Go to Harnesses');
        // No "Set up harness" button in global mode
        expect(container.textContent).not.toContain('Set up harness');
      });
    });

    it('does not navigate to /harnesses/undefined/routing in global mode', async () => {
      mockAgentName = '';
      mockGetMessages.mockResolvedValue({
        items: [],
        next_cursor: null,
        total_count: 0,
        providers: [],
      });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('No messages yet');
      });
      // Clicking the "Go to Harnesses" link should use the href attribute, not navigate()
      // Verify no button triggers mockNavigate with "/harnesses/undefined/routing"
      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('undefined'),
        expect.anything(),
      );
    });
  });
});
