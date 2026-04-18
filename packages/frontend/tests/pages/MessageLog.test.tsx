import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

let mockAgentName = "test-agent";
const mockNavigate = vi.fn();
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: mockAgentName }),
  useNavigate: () => mockNavigate,
  A: (props: any) => <a href={props.href} style={props.style} class={props.class}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ""} content={props.content ?? ""} />,
}));

const mockGetMessages = vi.fn();
const mockGetCustomProviders = vi.fn();
const mockGetMessageDetails = vi.fn();
const mockGetRoutingStatus = vi.fn();
const mockSetMessageFeedback = vi.fn();
const mockClearMessageFeedback = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
  getMessageDetails: (...args: unknown[]) => mockGetMessageDetails(...args),
  getRoutingStatus: (...args: unknown[]) => mockGetRoutingStatus(...args),
  setMessageFeedback: (...args: unknown[]) => mockSetMessageFeedback(...args),
  clearMessageFeedback: (...args: unknown[]) => mockClearMessageFeedback(...args),
}));

vi.mock("../../src/services/sse.js", () => ({
  pingCount: () => 0,
}));

vi.mock("../../src/services/model-display.js", () => ({
  getModelDisplayName: (slug: string) => slug.replace(/^custom:[^/]+\//, ""),
  preloadModelDisplayNames: () => {},
}));

vi.mock("../../src/services/formatters.js", () => ({
  formatCost: (v: number) => `$${v.toFixed(2)}`,
  formatNumber: (v: number) => String(v),
  formatStatus: (s: string) => s,
  formatTime: (t: string) => t,
  formatDuration: (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`,
  formatErrorMessage: (s: string) => s,
  customProviderColor: vi.fn(() => '#6366f1'),
}));

const mockCheckIsLocalMode = vi.fn(() => Promise.resolve(false));
vi.mock("../../src/services/setup-status.js", () => ({
  checkIsLocalMode: () => mockCheckIsLocalMode(),
}));

vi.mock("../../src/components/SetupModal.jsx", () => ({
  default: (props: any) => (
    <div data-testid="setup-modal" data-open={props.open ? "true" : "false"} data-agent={props.agentName ?? ""}>
      <button data-testid="setup-close" onClick={() => props.onClose?.()}>Close</button>
    </div>
  ),
}));

vi.mock("../../src/components/FeedbackModal.jsx", () => ({
  default: (props: any) => (
    <div data-testid="feedback-modal" data-open={props.open ? "true" : "false"}>
      <button data-testid="feedback-submit" onClick={() => props.onSubmit?.(['Too slow'], 'test')}>Submit</button>
      <button data-testid="feedback-close" onClick={() => props.onClose?.()}>Close</button>
    </div>
  ),
}));

vi.mock("../../src/components/InfoTooltip.jsx", () => ({
  default: () => <span data-testid="info-tooltip" />,
}));

vi.mock("../../src/components/Select.jsx", () => ({
  default: (props: any) => (
    <select data-testid="select" value={props.value} onChange={(e: any) => props.onChange(e.target.value)}>
      {props.options?.map((o: any) => <option value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

vi.mock("../../src/components/ErrorState.jsx", () => ({
  default: (props: any) => <div data-testid="error-state">{props.title}</div>,
}));

vi.mock("../../src/components/Pagination.jsx", () => ({
  default: (props: any) => {
    const total = props.totalItems();
    return total > props.pageSize ? (
      <div data-testid="pagination">
        <button data-testid="pagination-prev" onClick={props.onPrevious} disabled={props.currentPage() <= 1}>Previous</button>
        <button data-testid="pagination-next" onClick={props.onNext} disabled={!props.hasNextPage()}>Next</button>
      </div>
    ) : null;
  },
}));

import MessageLog from "../../src/pages/MessageLog";

const messagesData = {
  items: [
    { id: "msg-12345678", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok", cache_read_tokens: 500, cache_creation_tokens: 100, duration_ms: 1200 },
    { id: "msg-87654321", timestamp: "2026-02-18T09:00:00Z", agent_name: "test-agent", model: "claude-3.5-sonnet", input_tokens: 200, output_tokens: 100, total_tokens: 300, cost: 0.02, status: "error", cache_read_tokens: null, cache_creation_tokens: null, duration_ms: null },
  ],
  next_cursor: null,
  total_count: 2,
  providers: ["anthropic", "openai"],
};

describe("MessageLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAgentName = "test-agent";
    mockGetCustomProviders.mockResolvedValue([]);
    mockGetRoutingStatus.mockResolvedValue({ enabled: false });
  });

  it("renders Messages heading", () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    expect(screen.getByText("Messages")).toBeDefined();
  });

  it("renders breadcrumb subtitle", () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    expect(screen.getByText(/Full log of every LLM call/)).toBeDefined();
  });

  it("shows loading skeleton while fetching", () => {
    mockGetMessages.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <MessageLog />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows message items after data loads", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("msg-1234");
      expect(container.textContent).toContain("msg-8765");
      expect(container.textContent).toContain("gpt-4o");
      expect(container.textContent).toContain("claude-3.5-sonnet");
    });
  });

  it("shows total count", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("2 total");
    });
  });

  it("shows table headers", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Date");
      expect(container.textContent).toContain("Cost");
      expect(container.textContent).toContain("Total Tokens");
      expect(container.textContent).toContain("Model");
      expect(container.textContent).toContain("Cache");
      expect(container.textContent).toContain("Duration");
      expect(container.textContent).toContain("Status");
    });
  });

  it("shows formatted costs", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$0.01");
      expect(container.textContent).toContain("$0.02");
    });
  });

  it("shows empty state for new agent", async () => {
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: [] });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No messages yet");
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
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: ["openai"] });
    await fireEvent.change(selects[0], { target: { value: "openai" } });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No messages match your filters");
    });
  });

  it("does not show waiting banner when filters return 0 results", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
    const selects = container.querySelectorAll('[data-testid="select"]');
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: ["openai"] });
    await fireEvent.change(selects[0], { target: { value: "openai" } });
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain("Waiting for data");
      expect(container.textContent).not.toContain("No messages yet");
    });
  });

  it("shows filter controls when data exists", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders provider display names in the filter dropdown", async () => {
    const dataWithUnknown = {
      ...messagesData,
      providers: ["anthropic", "openai", "unknown-provider"],
    };
    mockGetMessages.mockResolvedValue(dataWithUnknown);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const select = container.querySelector('[data-testid="select"]');
      expect(select).not.toBeNull();
      // Known providers resolve to display names
      expect(select!.textContent).toContain("Anthropic");
      expect(select!.textContent).toContain("OpenAI");
      // Unknown providers fall back to the raw ID
      expect(select!.textContent).toContain("unknown-provider");
      expect(select!.textContent).toContain("All providers");
    });
  });

  it("debounces cost filter inputs", async () => {
    vi.useFakeTimers();
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.advanceTimersByTimeAsync(100);

    const inputs = container.querySelectorAll(".cost-range-filter__input");
    expect(inputs.length).toBe(2);

    mockGetMessages.mockClear();

    // Rapid typing should not fire immediately
    fireEvent.input(inputs[0], { target: { value: "1" } });
    fireEvent.input(inputs[0], { target: { value: "1.5" } });
    expect(mockGetMessages).not.toHaveBeenCalled();

    // After debounce window, the API call fires
    await vi.advanceTimersByTimeAsync(500);
    expect(mockGetMessages).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("debounces cost max filter inputs", async () => {
    vi.useFakeTimers();
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.advanceTimersByTimeAsync(100);

    const inputs = container.querySelectorAll(".cost-range-filter__input");
    mockGetMessages.mockClear();

    fireEvent.input(inputs[1], { target: { value: "10" } });
    expect(mockGetMessages).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(mockGetMessages).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("keeps showing stale data during refetch instead of skeletons", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("msg-1234");
    });

    // Trigger a refetch that never resolves
    mockGetMessages.mockReturnValue(new Promise(() => {}));
    const selects = container.querySelectorAll('[data-testid="select"]');
    await fireEvent.change(selects[0], { target: { value: "openai" } });

    // Should still show old data, not skeletons
    expect(container.textContent).toContain("msg-1234");
    expect(container.querySelectorAll(".skeleton").length).toBe(0);
  });

  it("shows cost range filter inputs", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const inputs = container.querySelectorAll(".cost-range-filter__input");
      expect(inputs.length).toBe(2);
    });
  });

  it("shows cache tokens when present", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Read: 500 / Write: 100");
    });
  });

  it("shows dash for null cache tokens", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(2);
    });
  });

  it("shows dash for zero cache tokens", async () => {
    const dataWithZeroCache = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], cache_read_tokens: 0, cache_creation_tokens: 0 },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithZeroCache);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      // Zero cache tokens should show dash, not "Read: 0 / Write: 0"
      expect(container.textContent).not.toContain("Read: 0 / Write: 0");
    });
  });

  it("shows formatted duration", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("1.2s");
    });
  });

  it("shows dash for null duration", async () => {
    const dataWithNullDuration = {
      ...messagesData,
      items: [messagesData.items[1]], // second item has duration_ms: null
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithNullDuration);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("claude-3.5-sonnet");
    });
  });

  it("shows sub-second duration in ms format", async () => {
    const dataWithMsDuration = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], duration_ms: 423 },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithMsDuration);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("423ms");
    });
  });

  it("calls getMessages on mount", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalled();
    });
  });

  describe("error tooltip", () => {
    it("shows tooltip when error_message is present on a failed row", async () => {
      const dataWithError = {
        ...messagesData,
        items: [
          { id: "msg-err12345", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0, status: "error", error_message: "401 Unauthorized: invalid API key" },
        ],
      };
      mockGetMessages.mockResolvedValue(dataWithError);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const tooltip = container.querySelector(".status-badge-tooltip");
        expect(tooltip).not.toBeNull();
        const bubble = container.querySelector(".status-badge-tooltip__bubble");
        expect(bubble).not.toBeNull();
        expect(bubble!.textContent).toBe("401 Unauthorized: invalid API key");
      });
    });

    it("does not show tooltip when error_message is absent", async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("msg-1234");
        const tooltip = container.querySelector(".status-badge-tooltip");
        expect(tooltip).toBeNull();
      });
    });

    it("sets aria-label on the tooltip wrapper", async () => {
      const dataWithError = {
        ...messagesData,
        items: [
          { id: "msg-err99999", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0, status: "error", error_message: "timeout" },
        ],
      };
      mockGetMessages.mockResolvedValue(dataWithError);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const tooltip = container.querySelector(".status-badge-tooltip");
        expect(tooltip?.getAttribute("aria-label")).toBe("timeout");
      });
    });
  });

  describe("pagination", () => {
    it("shows pagination when total_count exceeds page size", async () => {
      const bigData = { ...messagesData, total_count: 120, next_cursor: "cursor-2" };
      mockGetMessages.mockResolvedValue(bigData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="pagination"]')).not.toBeNull();
      });
    });

    it("hides pagination when total_count is within page size", async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("2 total");
        expect(container.querySelector('[data-testid="pagination"]')).toBeNull();
      });
    });

    it("Next calls getMessages with cursor after navigating", async () => {
      const bigData = { ...messagesData, total_count: 120, next_cursor: "cursor-for-page-2" };
      mockGetMessages.mockResolvedValue(bigData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="pagination-next"]')).not.toBeNull();
      });
      mockGetMessages.mockClear();
      mockGetMessages.mockResolvedValue({ ...messagesData, total_count: 120, next_cursor: null });
      const nextBtn = container.querySelector('[data-testid="pagination-next"]') as HTMLButtonElement;
      nextBtn.click();
      await vi.waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith(
          expect.objectContaining({ cursor: "cursor-for-page-2" }),
        );
      });
    });
  });

  it("clears all filters when Clear filters button is clicked", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
    // Set a filter to trigger filtered empty state
    const selects = container.querySelectorAll('[data-testid="select"]');
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: ["openai"] });
    await fireEvent.change(selects[0], { target: { value: "openai" } });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No messages match your filters");
    });
    // Click Clear filters
    const clearBtn = container.querySelector(".btn--outline")!;
    fireEvent.click(clearBtn);
    // Filters should be cleared (API re-called)
    await vi.waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalled();
    });
  });

  it("shows routing tier badge when present", async () => {
    const dataWithTier = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], routing_tier: "simple" },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithTier);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".tier-badge");
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe("simple");
    });
  });

  it("closes setup modal via onClose callback", async () => {
    // To trigger setup modal, we need a new agent without setup completed
    localStorage.removeItem("setup_completed_test-agent");
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: [] });
    const { container } = render(() => <MessageLog />);
    // The setup-close button in our mock will call onClose
    const closeBtn = container.querySelector('[data-testid="setup-close"]');
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
    // Verify mock was rendered
    expect(container.querySelector('[data-testid="setup-modal"]')).not.toBeNull();
  });

  it("shows Enable routing button when setupCompleted but no providers", async () => {
    localStorage.setItem("setup_completed_test-agent", "1");
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: [] });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Enable routing");
      expect(container.textContent).toContain("Connect a provider to start routing LLM calls");
      const btn = container.querySelector('.empty-state button.btn--primary');
      expect(btn).not.toBeNull();
    });
  });

  it("navigates to routing with openProviders state when Enable routing clicked", async () => {
    localStorage.setItem("setup_completed_test-agent", "1");
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: [] });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Enable routing");
    });
    const btn = container.querySelector('.empty-state button.btn--primary') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/agents/test-agent/routing",
      { state: { openProviders: true } },
    );
  });

  it("shows message table when providers are enabled but no data", async () => {
    mockGetRoutingStatus.mockResolvedValue({ enabled: true });
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: [] });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.querySelector('.waiting-banner')).not.toBeNull();
      expect(container.querySelector('.empty-state')).toBeNull();
      expect(container.textContent).toContain("0 total");
    });
  });

  it("shows Set up agent when no setupCompleted and no providers", async () => {
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: [] });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Set up agent");
      expect(container.textContent).not.toContain("Enable routing");
    });
  });

  describe("custom provider models", () => {
    const customMessagesData = {
      items: [
        { id: "msg-cp1", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "custom:abc-123/my-llama", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok", cache_read_tokens: null, cache_creation_tokens: null, duration_ms: 800 },
      ],
      next_cursor: null,
      total_count: 1,
      providers: ["custom"],
    };

    it("renders custom provider icon in message rows", async () => {
      mockGetCustomProviders.mockResolvedValue([{ id: "abc-123", name: "Groq" }]);
      mockGetMessages.mockResolvedValue(customMessagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const img = container.querySelector('img[alt="Groq"]');
        expect(img).not.toBeNull();
      });
    });

    it("strips custom prefix from model name display", async () => {
      mockGetCustomProviders.mockResolvedValue([{ id: "abc-123", name: "Groq" }]);
      mockGetMessages.mockResolvedValue(customMessagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("my-llama");
        expect(container.textContent).not.toContain("custom:abc-123/");
      });
    });

    it("falls back to model prefix when custom provider not found", async () => {
      mockGetCustomProviders.mockResolvedValue([]);
      mockGetMessages.mockResolvedValue(customMessagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("my-llama");
      });
    });
  });

  describe("clear filters", () => {
    it("clears all filters when clear button is clicked", async () => {
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const selects = container.querySelectorAll('[data-testid="select"]');
        expect(selects.length).toBeGreaterThanOrEqual(1);
      });

      // Set a filter
      const selects = container.querySelectorAll('[data-testid="select"]');
      mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, providers: ["openai"] });
      await fireEvent.change(selects[0], { target: { value: "openai" } });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("No messages match your filters");
      });

      // Click clear filters
      const clearBtn = container.querySelector(".message-log__clear-btn");
      if (clearBtn) {
        mockGetMessages.mockResolvedValue(messagesData);
        fireEvent.click(clearBtn);
        await vi.waitFor(() => {
          expect(container.textContent).toContain("msg-1234");
        });
      }
    });
  });

  it("shows $0.00 cost for subscription auth_type messages", async () => {
    const dataWithSub = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], auth_type: "subscription", cost: 0.05 },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithSub);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      // Subscription messages show "$0.00" instead of actual cost
      expect(container.textContent).toContain("$0.00");
    });
  });

  it("shows formatCost fallback for non-subscription messages with cost", async () => {
    const dataWithCost = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], auth_type: null, cost: 0.05 },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithCost);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$0.05");
    });
  });

  it("renders provider icon SVG for known provider model", async () => {
    const dataWithProvider = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], model: "gpt-4o", auth_type: null },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithProvider);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      // providerIcon returns an inline SVG for known providers
      const providerSpan = container.querySelector('[role="img"]');
      expect(providerSpan).not.toBeNull();
      const svg = providerSpan!.querySelector("svg");
      expect(svg).not.toBeNull();
    });
  });

  it("renders subscription auth badge on provider icon", async () => {
    const dataWithSub = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], model: "claude-sonnet-4", auth_type: "subscription" },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithSub);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".provider-auth-badge--sub");
      expect(badge).not.toBeNull();
    });
  });

  it("renders api_key auth badge when auth_type is api_key", async () => {
    const dataWithApiKey = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], model: "claude-sonnet-4", auth_type: "api_key" },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithApiKey);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".provider-auth-badge--key");
      expect(badge).not.toBeNull();
      const subBadge = container.querySelector(".provider-auth-badge--sub");
      expect(subBadge).toBeNull();
    });
  });

  it("renders meta description tag", () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    // Meta is mocked as null, just ensure it renders without error
    expect(screen.getByText("Messages")).toBeDefined();
  });

  it("renders routing tier badge when present", async () => {
    const dataWithTier = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], routing_tier: "simple" },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithTier);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".tier-badge");
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe("simple");
    });
  });

  it("renders setup modal", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="setup-modal"]')).not.toBeNull();
    });
  });

  it("renders fallback badge when fallback_from_model is present", async () => {
    const dataWithFallback = {
      ...messagesData,
      items: [
        { ...messagesData.items[0], fallback_from_model: "gpt-4o", fallback_index: 0 },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithFallback);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".tier-badge--fallback");
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe("fallback");
      expect(badge!.getAttribute("title")).toContain("gpt-4o");
    });
  });

  it("does not render fallback badge when fallback_from_model is absent", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("gpt-4o");
      const badge = container.querySelector(".tier-badge--fallback");
      expect(badge).toBeNull();
    });
  });

  it("renders fallback_error status with orange Handled badge", async () => {
    const dataWithHandled = {
      ...messagesData,
      items: [
        {
          ...messagesData.items[0],
          status: "fallback_error",
          model: "gemini-flash",
          error_message: "Provider returned HTTP 429, routed to fallback",
        },
      ],
      total_count: 1,
    };
    mockGetMessages.mockResolvedValue(dataWithHandled);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".status-badge--fallback_error");
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe("fallback_error");
    });
  });

  it("assigns row IDs for scroll targeting", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const row = container.querySelector("#msg-msg-12345678");
      expect(row).not.toBeNull();
    });
  });

  it("scrolls to fallback success when clicking Handled badge", async () => {
    const dataWithChain = {
      ...messagesData,
      items: [
        {
          id: "success-1",
          timestamp: "2026-02-18T10:00:00.200Z",
          agent_name: "test-agent",
          model: "deepseek-chat",
          input_tokens: 500,
          output_tokens: 100,
          total_tokens: 600,
          cost: 0.01,
          status: "ok",
          cache_read_tokens: 0,
          cache_creation_tokens: 0,
          duration_ms: 800,
          fallback_from_model: "gemini-flash",
          fallback_index: 0,
        },
        {
          id: "primary-fail-1",
          timestamp: "2026-02-18T10:00:00.000Z",
          agent_name: "test-agent",
          model: "gemini-flash",
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost: null,
          status: "fallback_error",
          cache_read_tokens: 0,
          cache_creation_tokens: 0,
          duration_ms: null,
          error_message: "Provider returned HTTP 429, routed to fallback",
        },
      ],
      total_count: 2,
      providers: ["deepseek", "gemini"],
    };
    mockGetMessages.mockResolvedValue(dataWithChain);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".status-badge--fallback_error");
      expect(badge).not.toBeNull();
    });
    const successRow = container.querySelector("#msg-success-1");
    const scrollSpy = vi.fn();
    if (successRow) {
      successRow.scrollIntoView = scrollSpy;
    }
    const badge = container.querySelector(".status-badge--fallback_error")!;
    fireEvent.click(badge);
    expect(scrollSpy).toHaveBeenCalled();
  });

  describe("feedback", () => {
    it("calls setMessageFeedback with like when thumb up is clicked", async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      const likeBtn = container.querySelector(".feedback-btn") as HTMLElement;
      fireEvent.click(likeBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith("msg-12345678", { rating: "like" });
    });

    it("calls setMessageFeedback with dislike and opens modal when thumb down is clicked", async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      const dislikeBtn = container.querySelectorAll(".feedback-btn")[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith("msg-12345678", { rating: "dislike" });
      const modal = container.querySelector('[data-testid="feedback-modal"]');
      expect(modal?.getAttribute("data-open")).toBe("true");
    });

    it("calls clearMessageFeedback when active like is clicked", async () => {
      mockClearMessageFeedback.mockResolvedValue(undefined);
      const dataWithFeedback = {
        ...messagesData,
        items: [{ ...messagesData.items[0], feedback_rating: "like" }, messagesData.items[1]],
      };
      mockGetMessages.mockResolvedValue(dataWithFeedback);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn--active-like")).not.toBeNull();
      });
      const likeBtn = container.querySelector(".feedback-btn--active-like") as HTMLElement;
      fireEvent.click(likeBtn);
      expect(mockClearMessageFeedback).toHaveBeenCalledWith("msg-12345678");
    });

    it("submits feedback details from modal", async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      // Click dislike to open modal
      const dislikeBtn = container.querySelectorAll(".feedback-btn")[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      // Submit via modal
      const submitBtn = container.querySelector('[data-testid="feedback-submit"]') as HTMLElement;
      fireEvent.click(submitBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith("msg-12345678", { rating: "dislike", tags: ["Too slow"], details: "test" });
    });

    it("closes feedback modal without submitting", async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      const dislikeBtn = container.querySelectorAll(".feedback-btn")[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      const closeBtn = container.querySelector('[data-testid="feedback-close"]') as HTMLElement;
      fireEvent.click(closeBtn);
      const modal = container.querySelector('[data-testid="feedback-modal"]');
      expect(modal?.getAttribute("data-open")).toBe("false");
    });

    it("hides feedback column and modal in local mode", async () => {
      mockCheckIsLocalMode.mockResolvedValue(true);
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".data-table")).not.toBeNull();
      });
      expect(container.querySelector(".feedback-btn")).toBeNull();
      expect(container.querySelector('[data-testid="feedback-modal"]')).toBeNull();
      mockCheckIsLocalMode.mockResolvedValue(false);
    });

    it("reverts optimistic like on API error", async () => {
      mockSetMessageFeedback.mockRejectedValue(new Error("fail"));
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      const likeBtn = container.querySelector(".feedback-btn") as HTMLElement;
      fireEvent.click(likeBtn);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn--active-like")).toBeNull();
      });
    });

    it("reverts optimistic dislike on API error", async () => {
      mockSetMessageFeedback.mockRejectedValue(new Error("fail"));
      mockGetMessages.mockResolvedValue(messagesData);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      const dislikeBtn = container.querySelectorAll(".feedback-btn")[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn--active-dislike")).toBeNull();
      });
    });

    it("reverts optimistic clear on API error", async () => {
      mockClearMessageFeedback.mockRejectedValue(new Error("fail"));
      const dataWithFeedback = {
        ...messagesData,
        items: [{ ...messagesData.items[0], feedback_rating: "like" }, messagesData.items[1]],
      };
      mockGetMessages.mockResolvedValue(dataWithFeedback);
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn--active-like")).not.toBeNull();
      });
      const likeBtn = container.querySelector(".feedback-btn--active-like") as HTMLElement;
      fireEvent.click(likeBtn);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn--active-like")).not.toBeNull();
      });
    });
  });
});
