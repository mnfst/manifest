import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

let mockAgentName = "test-agent";
let mockLocationState: any = null;
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: mockAgentName }),
  useLocation: () => ({ pathname: `/agents/${mockAgentName}`, state: mockLocationState }),
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
}));

let mockIsLocalMode: boolean | null = false;
vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => mockIsLocalMode,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockGetOverview = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getOverview: (...args: unknown[]) => mockGetOverview(...args),
}));

vi.mock("../../src/services/sse.js", () => ({
  pingCount: () => 0,
}));

vi.mock("../../src/services/formatters.js", () => ({
  formatCost: (v: number) => `$${v.toFixed(2)}`,
  formatNumber: (v: number) => String(v),
  formatStatus: (s: string) => s,
  formatTime: (t: string) => t,
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

vi.mock("../../src/components/SetupModal.jsx", () => ({
  default: (props: any) => <div data-testid="setup-modal" data-open={props.open ? "true" : "false"} />,
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
    { model: "gpt-4o", tokens: 30000, share_pct: 60, estimated_cost: 2.1 },
    { model: "claude-3.5-sonnet", tokens: 20000, share_pct: 40, estimated_cost: 1.4 },
  ],
  recent_activity: [
    { id: "msg-12345678", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok" },
  ],
  has_data: true,
};

describe("Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAgentName = "test-agent";
    mockLocationState = null;
    mockIsLocalMode = false;
  });

  it("renders Overview heading", () => {
    mockGetOverview.mockResolvedValue(overviewData);
    render(() => <Overview />);
    expect(screen.getByText("Overview")).toBeDefined();
  });

  it("renders breadcrumb subtitle", () => {
    mockGetOverview.mockResolvedValue(overviewData);
    render(() => <Overview />);
    expect(screen.getByText("Monitor your agent's costs, tokens, and activity")).toBeDefined();
  });

  it("shows loading skeleton while fetching", () => {
    mockGetOverview.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <Overview />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
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

  it("shows empty state for new agent with no data", async () => {
    mockGetOverview.mockResolvedValue({ ...overviewData, has_data: false, summary: null });
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
      expect(container.querySelector('[data-testid="cost-chart"]')).not.toBeNull();
    });

    // Click tokens stat
    const stats = container.querySelectorAll(".chart-card__stat--clickable");
    fireEvent.click(stats[1]); // tokens
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="token-chart"]')).not.toBeNull();
    });

    // Click messages stat
    fireEvent.click(stats[2]); // messages
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="single-token-chart"]')).not.toBeNull();
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

  describe("local mode", () => {
    it("should auto-complete setup for local-agent in local mode", async () => {
      mockAgentName = "local-agent";
      mockIsLocalMode = true;
      mockGetOverview.mockResolvedValue({ ...overviewData, has_data: false, summary: null });
      render(() => <Overview />);
      await vi.waitFor(() => {
        expect(localStorage.getItem("setup_completed_local-agent")).toBe("1");
      });
    });

    it("should not open setup modal for local-agent in local mode", async () => {
      mockAgentName = "local-agent";
      mockIsLocalMode = true;
      mockGetOverview.mockResolvedValue({ ...overviewData, has_data: false, summary: null });
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("false");
      });
    });

    it("should show waiting banner instead of empty state for local-agent in local mode", async () => {
      mockAgentName = "local-agent";
      mockIsLocalMode = true;
      mockGetOverview.mockResolvedValue({ ...overviewData, has_data: false, summary: null });
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("dashboard will populate");
      });
    });

    it("should still open setup modal for non-local-agent even in local mode", async () => {
      mockAgentName = "other-agent";
      mockIsLocalMode = true;
      mockGetOverview.mockResolvedValue({ ...overviewData, has_data: false, summary: null });
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("true");
      });
    });

    it("should still open setup modal for local-agent when not in local mode", async () => {
      mockAgentName = "local-agent";
      mockIsLocalMode = false;
      mockGetOverview.mockResolvedValue({ ...overviewData, has_data: false, summary: null });
      const { container } = render(() => <Overview />);
      await vi.waitFor(() => {
        const modal = container.querySelector('[data-testid="setup-modal"]');
        expect(modal?.getAttribute("data-open")).toBe("true");
      });
    });
  });
});
