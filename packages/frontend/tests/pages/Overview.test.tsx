import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

let mockAgentName = "test-agent";
let mockLocationState: any = null;
const mockNavigate = vi.fn();
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: mockAgentName }),
  useLocation: () => ({ pathname: `/agents/${mockAgentName}`, state: mockLocationState }),
  useNavigate: () => mockNavigate,
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ""} content={props.content ?? ""} />,
}));

const mockGetOverview = vi.fn();
const mockGetCustomProviders = vi.fn();
const mockSetMessageFeedback = vi.fn();
const mockClearMessageFeedback = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getOverview: (...args: unknown[]) => mockGetOverview(...args),
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
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
  formatErrorMessage: (s: string) => s,
  customProviderColor: vi.fn(() => '#6366f1'),
}));

const mockCheckIsSelfHosted = vi.fn(() => Promise.resolve(false));
vi.mock("../../src/services/setup-status.js", () => ({
  checkIsSelfHosted: () => mockCheckIsSelfHosted(),
}));

vi.mock("../../src/components/CostChart.jsx", () => ({
  default: () => <div data-testid="cost-chart" />,
}));

vi.mock("../../src/components/TokenChart.jsx", () => ({
  default: () => <div data-testid="token-chart" />,
}));

vi.mock("../../src/components/SingleTokenChart.jsx", () => ({
  default: () => <div data-testid="single-token-chart" />,
}));

vi.mock("../../src/components/FeedbackModal.jsx", () => ({
  default: (props: any) => (
    <div data-testid="feedback-modal" data-open={props.open ? "true" : "false"}>
      <button data-testid="feedback-submit" onClick={() => props.onSubmit?.(['Too slow'], 'test')}>Submit</button>
      <button data-testid="feedback-close" onClick={() => props.onClose?.()}>Close</button>
    </div>
  ),
}));

vi.mock("../../src/components/SetupModal.jsx", () => ({
  default: (props: any) => (
    <div data-testid="setup-modal" data-open={props.open ? "true" : "false"} data-agent={props.agentName ?? ""} data-api-key={props.apiKey ?? ""}>
      <button data-testid="setup-close" onClick={() => props.onClose?.()}>Close</button>
      <button data-testid="setup-done" onClick={() => props.onDone?.()}>Done</button>
      <button data-testid="setup-go-routing" onClick={() => props.onGoToRouting?.()}>Go to routing</button>
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

const mockIsRecentlyCreated = vi.fn(() => false);
vi.mock("../../src/services/recent-agents.js", () => ({
  isRecentlyCreated: (...args: unknown[]) => mockIsRecentlyCreated(...args),
}));

import Overview from "../../src/pages/Overview";

const overviewData = {
  summary: {
    tokens_today: { value: 50000, trend_pct: 12, sub_values: { input: 30000, output: 20000 } },
    cost_today: { value: 3.5, trend_pct: -5 },
    messages: { value: 42, trend_pct: 8 },
    services_hit: { total: 3, healthy: 3, issues: 0 },
  },
  token_usage: [{ hour: "2026-02-18 10:00:00", input_tokens: 1000, output_tokens: 500 }],
  cost_usage: [{ hour: "2026-02-18 10:00:00", cost: 0.5 }],
  message_usage: [{ hour: "2026-02-18 10:00:00", count: 5 }],
  cost_by_model: [
    { model: "gpt-4o", tokens: 30000, share_pct: 60, estimated_cost: 2.1, auth_type: "api_key" },
    { model: "claude-3.5-sonnet", tokens: 20000, share_pct: 40, estimated_cost: 1.4, auth_type: "subscription" },
  ],
  recent_activity: [
    { id: "msg-12345678", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok" },
  ],
  has_data: true,
};

const emptyOverviewData = {
  summary: {
    tokens_today: { value: 0, trend_pct: 0 },
    cost_today: { value: 0, trend_pct: 0 },
    messages: { value: 0, trend_pct: 0 },
    services_hit: { total: 0, healthy: 0, issues: 0 },
  },
  token_usage: [],
  cost_usage: [],
  message_usage: [],
  cost_by_model: [],
  recent_activity: [],
  has_data: false,
  has_providers: false,
};

describe("Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAgentName = "test-agent";
    mockLocationState = null;
    mockGetCustomProviders.mockResolvedValue([]);
  });

  it("renders Overview heading with agent name", () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    expect(container.textContent).toContain("Overview");
  });

  it("renders breadcrumb subtitle", () => {
    mockGetOverview.mockResolvedValue(overviewData);
    render(() => <Overview />);
    expect(screen.getByText(/Real-time summary of spending/)).toBeDefined();
  });

  it("shows loading skeleton while fetching", () => {
    mockGetOverview.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <Overview />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("keeps showing stale data during refetch instead of skeletons", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$3.50");
    });

    // Trigger a refetch that never resolves
    mockGetOverview.mockReturnValue(new Promise(() => {}));
    const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: "24h" } });

    // Should still show old data, not skeletons
    expect(container.textContent).toContain("$3.50");
    expect(container.querySelectorAll(".skeleton").length).toBe(0);
  });

  it("shows summary stats after data loads", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$3.50");
      expect(container.textContent).toContain("50000");
      expect(container.textContent).toContain("42");
    });
  });

  it("shows trend badges with percentages", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("+12%");
      expect(container.textContent).toContain("-5%");
      expect(container.textContent).toContain("+8%");
    });
  });

  it("hides trend badges when metric values are zero", async () => {
    const zeroData = {
      ...overviewData,
      summary: {
        ...overviewData.summary,
        cost_today: { value: 0, trend_pct: -34497259 },
        tokens_today: { value: 0, trend_pct: 500, sub_values: { input: 0, output: 0 } },
        messages: { value: 0, trend_pct: -100 },
      },
    };
    mockGetOverview.mockResolvedValue(zeroData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$0.00");
      const trends = container.querySelectorAll(".trend");
      expect(trends.length).toBe(0);
    });
  });

  it("clamps absurdly large trend percentages", async () => {
    const absurdData = {
      ...overviewData,
      summary: {
        ...overviewData.summary,
        cost_today: { value: 5.0, trend_pct: 5000000 },
      },
    };
    mockGetOverview.mockResolvedValue(absurdData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("+999%");
      expect(container.textContent).not.toContain("5000000%");
    });
  });

  it("shows recent messages table", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Recent Messages");
      expect(container.textContent).toContain("msg-1234");
      expect(container.textContent).toContain("gpt-4o");
    });
  });

  it("shows cost by model table", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Cost by Model");
      expect(container.textContent).toContain("gpt-4o");
      expect(container.textContent).toContain("claude-3.5-sonnet");
      expect(container.textContent).toContain("60%");
    });
  });

  it("sorts cost by model rows by estimated_cost descending", async () => {
    const data = {
      ...overviewData,
      cost_by_model: [
        { model: "claude-3.5-sonnet", tokens: 20000, share_pct: 40, estimated_cost: 1.4, auth_type: "subscription" },
        { model: "gpt-4o", tokens: 30000, share_pct: 60, estimated_cost: 2.1, auth_type: "api_key" },
      ],
    };
    mockGetOverview.mockResolvedValue(data);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const panels = container.querySelectorAll(".panel");
      // Find the Cost by Model panel
      const costPanel = Array.from(panels).find(p => p.textContent?.includes("Cost by Model"));
      expect(costPanel).toBeDefined();
      const rows = costPanel!.querySelectorAll("tbody tr");
      expect(rows.length).toBe(2);
      // gpt-4o ($2.1) should come before claude ($1.4) even though claude is first in data
      expect(rows[0].textContent).toContain("gpt-4o");
      expect(rows[1].textContent).toContain("claude-3.5-sonnet");
    });
  });

  it("renders auth badges on cost by model provider icons", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const panels = container.querySelectorAll(".panel");
      const costPanel = Array.from(panels).find(p => p.textContent?.includes("Cost by Model"));
      expect(costPanel).toBeDefined();
      const keyBadge = costPanel!.querySelector(".provider-auth-badge--key");
      const subBadge = costPanel!.querySelector(".provider-auth-badge--sub");
      expect(keyBadge).not.toBeNull();
      expect(subBadge).not.toBeNull();
    });
  });

  it("shows empty state for new agent with no data", async () => {
    mockGetOverview.mockResolvedValue(emptyOverviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No activity yet");
    });
  });

  it("calls getOverview on mount", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    render(() => <Overview />);
    await vi.waitFor(() => {
      expect(mockGetOverview).toHaveBeenCalled();
    });
  });

  it("has clickable stat headers for cost, tokens, messages", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const clickable = container.querySelectorAll(".chart-card__stat--clickable");
      expect(clickable.length).toBe(3);
    });
  });

  it("switches chart view when stat header clicked", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="single-token-chart"]')).not.toBeNull();
    });

    // Click cost stat
    const stats = container.querySelectorAll(".chart-card__stat--clickable");
    fireEvent.click(stats[1]); // cost
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="cost-chart"]')).not.toBeNull();
    });

    // Click tokens stat
    fireEvent.click(stats[2]); // tokens
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="token-chart"]')).not.toBeNull();
    });
  });

  it("shows View more link to messages page", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const link = container.querySelector('a.view-more-link') as HTMLAnchorElement;
      expect(link).not.toBeNull();
      expect(link.getAttribute("href")).toBe("/agents/test-agent/messages");
    });
  });

  describe("error tooltip", () => {
    it("shows tooltip when error_message is present on a failed row", async () => {
      const dataWithError = {
        ...overviewData,
        recent_activity: [
          { id: "msg-err12345", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0, status: "error", error_message: "401 Unauthorized: invalid API key" },
        ],
      };
      mockGetOverview.mockResolvedValue(dataWithError);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const tooltip = container.querySelector(".status-badge-tooltip");
        expect(tooltip).not.toBeNull();
        const bubble = container.querySelector(".status-badge-tooltip__bubble");
        expect(bubble).not.toBeNull();
        expect(bubble!.textContent).toBe("401 Unauthorized: invalid API key");
      });
    });

    it("does not show tooltip when error_message is absent", async () => {
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("msg-1234");
        const tooltip = container.querySelector(".status-badge-tooltip");
        expect(tooltip).toBeNull();
      });
    });

    it("sets aria-label on the tooltip wrapper", async () => {
      const dataWithError = {
        ...overviewData,
        recent_activity: [
          { id: "msg-err99999", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0, status: "error", error_message: "timeout" },
        ],
      };
      mockGetOverview.mockResolvedValue(dataWithError);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const tooltip = container.querySelector(".status-badge-tooltip");
        expect(tooltip?.getAttribute("aria-label")).toBe("timeout");
      });
    });
  });

  describe("custom provider models", () => {
    const customOverview = {
      ...overviewData,
      recent_activity: [
        { id: "msg-cp1", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "custom:abc-123/my-llama", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok" },
      ],
      cost_by_model: [
        { model: "custom:abc-123/my-llama", tokens: 30000, share_pct: 100, estimated_cost: 2.1, auth_type: "api_key" },
      ],
    };

    it("renders custom provider icon in recent messages", async () => {
      mockGetCustomProviders.mockResolvedValue([{ id: "abc-123", name: "Groq" }]);
      mockGetOverview.mockResolvedValue(customOverview);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const img = container.querySelector('img[alt="Groq"]');
        expect(img).not.toBeNull();
      });
    });

    it("strips custom prefix from model name display", async () => {
      mockGetCustomProviders.mockResolvedValue([{ id: "abc-123", name: "Groq" }]);
      mockGetOverview.mockResolvedValue(customOverview);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("my-llama");
        expect(container.textContent).not.toContain("custom:abc-123/");
      });
    });

    it("renders custom provider icon in cost by model table", async () => {
      mockGetCustomProviders.mockResolvedValue([{ id: "abc-123", name: "Groq" }]);
      mockGetOverview.mockResolvedValue(customOverview);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const imgs = container.querySelectorAll('img[alt="Groq"]');
        // At least one in recent messages and one in cost by model
        expect(imgs.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("falls back to model prefix when custom provider not found", async () => {
      mockGetCustomProviders.mockResolvedValue([]);
      mockGetOverview.mockResolvedValue(customOverview);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("my-llama");
      });
    });
  });

  describe("setup modal callbacks", () => {
    it("closes setup modal and sets dismissed flag", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("true");
      });

      const closeBtn = container.querySelector('[data-testid="setup-close"]') as HTMLButtonElement;
      fireEvent.click(closeBtn);

      await vi.waitFor(() => {
        expect(localStorage.getItem("setup_dismissed_test-agent")).toBe("1");
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("false");
      });
    });

    it("marks setup as completed when onDone is called", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("true");
      });

      const doneBtn = container.querySelector('[data-testid="setup-done"]') as HTMLButtonElement;
      fireEvent.click(doneBtn);

      await vi.waitFor(() => {
        expect(localStorage.getItem("setup_completed_test-agent")).toBe("1");
      });
    });
  });

  it("shows waiting banner when has_providers is true but has_data is false", async () => {
    mockGetOverview.mockResolvedValue({ ...emptyOverviewData, has_providers: true });
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No activity yet");
      expect(container.querySelector('.waiting-banner')).not.toBeNull();
      expect(container.querySelector('.empty-state')).toBeNull();
    });
  });

  it("shows dashboard with zeros when has_providers is true but has_data is false", async () => {
    mockGetOverview.mockResolvedValue({ ...emptyOverviewData, has_providers: true });
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.querySelector('.chart-card__stat--clickable')).not.toBeNull();
      expect(container.textContent).toContain("$0.00");
    });
  });

  it("shows full dashboard when has_data is true regardless of has_providers", async () => {
    mockGetOverview.mockResolvedValue({ ...overviewData, has_data: true, has_providers: false });
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.querySelector('.chart-card__stat--clickable')).not.toBeNull();
      expect(container.querySelector('.empty-state')).toBeNull();
    });
  });

  it("does not show waiting banner when has_data is true", async () => {
    mockGetOverview.mockResolvedValue({ ...overviewData, has_data: true, has_providers: true });
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.querySelector('.waiting-banner')).toBeNull();
    });
  });

  it("shows Connect provider button when setupCompleted but no providers and no data", async () => {
    localStorage.setItem("setup_completed_test-agent", "1");
    mockGetOverview.mockResolvedValue(emptyOverviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Connect provider");
      expect(container.textContent).toContain("Connect a provider to start routing LLM calls");
      expect(container.textContent).not.toContain("Enable routing");
      const btn = container.querySelector('.empty-state button.btn--primary');
      expect(btn).not.toBeNull();
    });
  });

  it("navigates to routing with openProviders state when Connect provider clicked", async () => {
    localStorage.setItem("setup_completed_test-agent", "1");
    mockGetOverview.mockResolvedValue(emptyOverviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Connect provider");
    });
    const btn = container.querySelector('.empty-state button.btn--primary') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/agents/test-agent/routing",
      { state: { openProviders: true } },
    );
  });

  it("shows Set up agent button when not setupCompleted and no providers", async () => {
    mockGetOverview.mockResolvedValue(emptyOverviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Set up agent");
      expect(container.textContent).not.toContain("Enable routing");
      expect(container.textContent).not.toContain("Connect provider");
    });
  });

  describe("SetupModal callbacks", () => {
    it("sets localStorage and closes modal on onClose", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("true");
      });
      fireEvent.click(screen.getByTestId("setup-close"));
      expect(localStorage.getItem("setup_dismissed_test-agent")).toBe("1");
    });

    it("sets localStorage on onDone", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("true");
      });
      fireEvent.click(screen.getByTestId("setup-done"));
      expect(localStorage.getItem("setup_completed_test-agent")).toBe("1");
    });

    it("navigates to routing page on onGoToRouting", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      render(() => <Overview />);
      await vi.waitFor(() => {
        expect(screen.getByTestId("setup-go-routing")).toBeDefined();
      });
      fireEvent.click(screen.getByTestId("setup-go-routing"));
      expect(mockNavigate).toHaveBeenCalledWith(
        "/agents/test-agent/routing",
        { state: { openProviders: true } },
      );
    });
  });

  describe("range persistence", () => {
    it("persists range selection in localStorage", async () => {
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="select"]')).not.toBeNull();
      });
      const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
      await fireEvent.change(select, { target: { value: "24h" } });
      expect(localStorage.getItem("manifest_chart_range")).toBe("24h");
    });

    it("reads persisted range from localStorage on mount", async () => {
      localStorage.setItem("manifest_chart_range", "24h");
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
        expect(select.value).toBe("24h");
      });
    });

    it("defaults to 30d when no localStorage value", async () => {
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
        expect(select.value).toBe("30d");
      });
    });

    it("ignores stale localStorage value and defaults to 30d", async () => {
      localStorage.setItem("manifest_chart_range", "1h");
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
        expect(select.value).toBe("30d");
      });
    });
  });

  describe("smart default range", () => {
    it("cascades to smaller range when data arrays are all empty", async () => {
      const emptyUsageData = {
        ...overviewData,
        has_data: true,
        token_usage: [],
        cost_usage: [],
        message_usage: [],
      };
      mockGetOverview.mockResolvedValue(emptyUsageData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        // Cascades from 30d → 7d → 24h (all empty, lands at final range)
        const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
        expect(select.value).toBe("24h");
      });
    });

    it("does not cascade when user has manually selected a range", async () => {
      localStorage.setItem("manifest_chart_range", "30d");
      const emptyUsageData = {
        ...overviewData,
        has_data: true,
        token_usage: [],
        cost_usage: [],
        message_usage: [],
      };
      mockGetOverview.mockResolvedValue(emptyUsageData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
        expect(select.value).toBe("30d");
      });
    });

    it("stays on current range when there is data", async () => {
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement;
        expect(select.value).toBe("30d");
      });
    });
  });

  it("renders provider icon and auth badge in cost_by_model for known providers", async () => {
    const dataWithKnownModel = {
      ...overviewData,
      cost_by_model: [
        { model: "gpt-4o", tokens: 30000, share_pct: 100, estimated_cost: 2.1, auth_type: "api_key" },
      ],
    };
    mockGetOverview.mockResolvedValue(dataWithKnownModel);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const panels = container.querySelectorAll(".panel");
      const costPanel = Array.from(panels).find(p => p.textContent?.includes("Cost by Model"));
      expect(costPanel).toBeDefined();
      // Verify the provider icon SVG is rendered (aria-hidden, not role="img")
      const icon = costPanel!.querySelector('svg[aria-hidden="true"]');
      expect(icon).not.toBeNull();
      // Verify auth badge is rendered
      const keyBadge = costPanel!.querySelector(".provider-auth-badge--key");
      expect(keyBadge).not.toBeNull();
    });
  });

  it("shows $0.00 cost for subscription auth_type messages in recent activity", async () => {
    const dataWithSub = {
      ...overviewData,
      recent_activity: [
        { ...overviewData.recent_activity[0], auth_type: "subscription", cost: 0.05 },
      ],
    };
    mockGetOverview.mockResolvedValue(dataWithSub);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const subCost = container.querySelector('[title="Included in subscription"]');
      expect(subCost).not.toBeNull();
      expect(subCost!.textContent).toBe("$0.00");
    });
  });

  it("shows formatCost for non-subscription messages with cost in recent activity", async () => {
    const dataWithCost = {
      ...overviewData,
      recent_activity: [
        { ...overviewData.recent_activity[0], auth_type: null, cost: 0.05 },
      ],
    };
    mockGetOverview.mockResolvedValue(dataWithCost);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$0.05");
    });
  });

  it("renders subscription auth badge on provider icon in recent activity", async () => {
    const dataWithSub = {
      ...overviewData,
      recent_activity: [
        { ...overviewData.recent_activity[0], model: "claude-sonnet-4", auth_type: "subscription" },
      ],
    };
    mockGetOverview.mockResolvedValue(dataWithSub);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".provider-auth-badge--sub");
      expect(badge).not.toBeNull();
    });
  });

  it("renders api_key auth badge when auth_type is api_key", async () => {
    const dataWithApiKey = {
      ...overviewData,
      recent_activity: [
        { ...overviewData.recent_activity[0], model: "claude-sonnet-4", auth_type: "api_key" },
      ],
      cost_by_model: overviewData.cost_by_model.map(r => ({ ...r, auth_type: "api_key" })),
    };
    mockGetOverview.mockResolvedValue(dataWithApiKey);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".provider-auth-badge--key");
      expect(badge).not.toBeNull();
      const subBadge = container.querySelector(".provider-auth-badge--sub");
      expect(subBadge).toBeNull();
    });
  });

  it("renders fallback badge in recent activity when fallback_from_model is present", async () => {
    const dataWithFallback = {
      ...overviewData,
      recent_activity: [
        { ...overviewData.recent_activity[0], fallback_from_model: "gpt-4o", fallback_index: 0 },
      ],
    };
    mockGetOverview.mockResolvedValue(dataWithFallback);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".tier-badge--fallback");
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe("fallback");
    });
  });

  it("does not render fallback badge in recent activity when fallback_from_model is absent", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("gpt-4o");
      const badge = container.querySelector(".tier-badge--fallback");
      expect(badge).toBeNull();
    });
  });

  it("renders fallback_error status with Handled badge in recent activity", async () => {
    const dataWithHandled = {
      ...overviewData,
      recent_activity: [
        {
          ...overviewData.recent_activity[0],
          status: "fallback_error",
          model: "gemini-flash",
          error_message: "Provider returned HTTP 429, routed to fallback",
        },
      ],
    };
    mockGetOverview.mockResolvedValue(dataWithHandled);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const badge = container.querySelector(".status-badge--fallback_error");
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe("fallback_error");
    });
  });

  describe("feedback", () => {
    it("calls setMessageFeedback with like when thumb up is clicked", async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      const likeBtn = container.querySelector(".feedback-btn") as HTMLElement;
      fireEvent.click(likeBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith("msg-12345678", { rating: "like" });
    });

    it("calls setMessageFeedback with dislike and opens modal", async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
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
        ...overviewData,
        recent_activity: [{ ...overviewData.recent_activity[0], feedback_rating: "like" }],
      };
      mockGetOverview.mockResolvedValue(dataWithFeedback);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn--active-like")).not.toBeNull();
      });
      const likeBtn = container.querySelector(".feedback-btn--active-like") as HTMLElement;
      fireEvent.click(likeBtn);
      expect(mockClearMessageFeedback).toHaveBeenCalledWith("msg-12345678");
    });

    it("submits feedback details from modal", async () => {
      mockSetMessageFeedback.mockResolvedValue(undefined);
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.querySelector(".feedback-btn")).not.toBeNull();
      });
      const dislikeBtn = container.querySelectorAll(".feedback-btn")[1] as HTMLElement;
      fireEvent.click(dislikeBtn);
      const submitBtn = container.querySelector('[data-testid="feedback-submit"]') as HTMLElement;
      fireEvent.click(submitBtn);
      expect(mockSetMessageFeedback).toHaveBeenCalledWith("msg-12345678", { rating: "dislike", tags: ["Too slow"], details: "test" });
    });

    it("hides feedback column and modal in the self-hosted version", async () => {
      mockCheckIsSelfHosted.mockResolvedValue(true);
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.querySelector(".data-table")).not.toBeNull();
      });
      expect(container.querySelector(".feedback-btn")).toBeNull();
      expect(container.querySelector('[data-testid="feedback-modal"]')).toBeNull();
      mockCheckIsSelfHosted.mockResolvedValue(false);
    });

    it("reverts optimistic like on API error", async () => {
      mockSetMessageFeedback.mockRejectedValue(new Error("fail"));
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
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
      mockGetOverview.mockResolvedValue(overviewData);
      const { container } = render(() => <Overview />);
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
        ...overviewData,
        recent_activity: [{ ...overviewData.recent_activity[0], feedback_rating: "like" }],
      };
      mockGetOverview.mockResolvedValue(dataWithFeedback);
      const { container } = render(() => <Overview />);
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
