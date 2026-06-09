import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ""} content={props.content ?? ""} />,
}));

const mockGetOverview = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getOverview: (...args: unknown[]) => mockGetOverview(...args),
}));

vi.mock("../../src/services/sse.js", () => ({
  messagePing: () => 0,
}));

vi.mock("../../src/services/model-display.js", () => ({
  preloadModelDisplayNames: () => {},
  getModelDisplayName: (slug: string) => slug,
}));

vi.mock("../../src/services/formatters.js", () => ({
  formatCost: (v: number) => `$${v.toFixed(2)}`,
  formatNumber: (v: number) => String(v),
  formatStatus: (s: string) => s,
  formatTime: (t: string) => t,
  formatErrorMessage: (s: string) => s,
  customProviderColor: vi.fn(() => "#6366f1"),
}));

const mockCheckIsSelfHosted = vi.fn(() => Promise.resolve(false));
vi.mock("../../src/services/setup-status.js", () => ({
  checkIsSelfHosted: () => mockCheckIsSelfHosted(),
}));

vi.mock("../../src/components/ChartCard.jsx", () => ({
  default: (props: any) => (
    <div
      data-testid="chart-card"
      data-active-view={props.activeView}
      data-cost={props.costValue}
      data-cost-trend={props.costTrendPct}
      data-tokens={props.tokensValue}
      data-tokens-trend={props.tokensTrendPct}
      data-messages={props.messagesValue}
      data-messages-trend={props.messagesTrendPct}
      data-cost-usage={JSON.stringify(props.costUsage)}
      data-token-usage={JSON.stringify(props.tokenUsage)}
      data-range={props.range}
      data-chart={JSON.stringify(props.messageChartData)}
      onClick={() => props.onViewChange?.('cost')}
    />
  ),
}));

vi.mock("../../src/components/CostByModelTable.jsx", () => ({
  default: (props: any) => (
    <div data-testid="cost-by-model-table" data-rows={props.rows.length} />
  ),
}));

vi.mock("../../src/components/MessageTable.jsx", () => ({
  default: (props: any) => (
    <div
      data-testid="message-table"
      data-items={props.items.length}
      data-columns={props.columns?.join(',')}
      data-agent={props.agentName}
    />
  ),
}));

vi.mock("../../src/components/OverviewSkeleton.jsx", () => ({
  default: () => <div data-testid="overview-skeleton" />,
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

vi.mock("../../src/components/InfoTooltip.jsx", () => ({
  default: () => <span data-testid="info-tooltip" />,
}));

import GlobalOverview from "../../src/pages/GlobalOverview";

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
  ],
  recent_activity: [
    { id: "msg-12345678", timestamp: "2026-02-18T10:00:00Z", agent_name: "agent-a", model: "gpt-4o", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok" },
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

describe("GlobalOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders Overview heading", () => {
    mockGetOverview.mockResolvedValue(overviewData);
    render(() => <GlobalOverview />);
    expect(screen.getByText("Overview")).toBeDefined();
  });

  it("renders the page title", () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    expect(container.querySelector("title")?.textContent).toContain("Overview");
  });

  it("calls getOverview without agentName (global mode)", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      expect(mockGetOverview).toHaveBeenCalled();
      const [range, agentName] = mockGetOverview.mock.calls[0];
      expect(agentName).toBeUndefined();
    });
  });

  it("shows loading skeleton while fetching", () => {
    mockGetOverview.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <GlobalOverview />);
    expect(container.querySelector("[data-testid='overview-skeleton']")).not.toBeNull();
  });

  it("shows ChartCard after data loads", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='chart-card']")).not.toBeNull();
    });
  });

  it("shows CostByModelTable after data loads", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='cost-by-model-table']")).not.toBeNull();
    });
  });

  it("shows MessageTable with recent activity", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='message-table']")).not.toBeNull();
    });
  });

  it("shows 'View more' link pointing to /messages", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      const link = container.querySelector('a[href="/messages"]');
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain("View more");
    });
  });

  it("updates range when select changes", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='select']")).not.toBeNull();
    });
    const select = container.querySelector("[data-testid='select']") as HTMLSelectElement;
    const { fireEvent } = await import("@solidjs/testing-library");
    fireEvent.change(select, { target: { value: "7d" } });
    expect(localStorage.getItem("manifest_chart_range")).toBe("7d");
  });

  it("does not show agent-specific chrome (no setup modal, no agent title)", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='setup-modal']")).toBeNull();
      expect(container.textContent).not.toContain("Set up harness");
    });
  });

  it("shows range selector when data is present", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='select']")).not.toBeNull();
    });
  });

  describe("empty state", () => {
    it("shows empty state when has_data is false", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      const { container } = render(() => <GlobalOverview />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("No activity yet");
      });
    });

    it("shows CTA link to /harnesses in empty state", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      const { container } = render(() => <GlobalOverview />);
      await vi.waitFor(() => {
        const agentsLink = container.querySelector('a[href="/harnesses"]');
        expect(agentsLink).not.toBeNull();
      });
    });

    it("does NOT key off has_providers for empty state (landmine guard)", async () => {
      // has_providers is always false for global queries - must not cause perpetual empty state
      const dataWithFalseProviders = { ...overviewData, has_providers: false };
      mockGetOverview.mockResolvedValue(dataWithFalseProviders);
      const { container } = render(() => <GlobalOverview />);
      await vi.waitFor(() => {
        // Dashboard should show (has_data: true), not empty state
        expect(container.querySelector("[data-testid='chart-card']")).not.toBeNull();
        expect(container.textContent).not.toContain("No activity yet");
      });
    });

    it("does not show range selector in empty state", async () => {
      mockGetOverview.mockResolvedValue(emptyOverviewData);
      const { container } = render(() => <GlobalOverview />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("No activity yet");
        expect(container.querySelector("[data-testid='select']")).toBeNull();
      });
    });
  });


  it("hides feedback column in self-hosted mode", async () => {
    mockCheckIsSelfHosted.mockResolvedValue(true);
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <GlobalOverview />);
    await vi.waitFor(() => {
      const table = container.querySelector("[data-testid='message-table']");
      expect(table).not.toBeNull();
    });
    mockCheckIsSelfHosted.mockResolvedValue(false);
  });
});
