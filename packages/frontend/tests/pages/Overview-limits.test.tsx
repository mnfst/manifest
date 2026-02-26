import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";

let mockAgentName = "test-agent";
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: mockAgentName }),
  useLocation: () => ({ pathname: `/agents/${mockAgentName}`, state: null }),
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
}));

vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => false,
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

vi.mock("../../src/services/routing-utils.js", () => ({
  inferProviderFromModel: () => null,
  inferProviderName: () => "",
}));

vi.mock("../../src/components/ProviderIcon.jsx", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/components/CostChart.jsx", () => ({ default: () => <div data-testid="cost-chart" /> }));
vi.mock("../../src/components/TokenChart.jsx", () => ({ default: () => <div data-testid="token-chart" /> }));
vi.mock("../../src/components/SingleTokenChart.jsx", () => ({ default: () => <div data-testid="single-token-chart" /> }));
vi.mock("../../src/components/SetupModal.jsx", () => ({
  default: (props: any) => <div data-testid="setup-modal" data-open={props.open ? "true" : "false"} />,
}));
vi.mock("../../src/components/InfoTooltip.jsx", () => ({ default: () => <span data-testid="info-tooltip" /> }));
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
    tokens_today: { value: 50000, trend_pct: 12 },
    cost_today: { value: 3.5, trend_pct: -5 },
    messages: { value: 42, trend_pct: 8 },
    services_hit: { total: 3, healthy: 3, issues: 0 },
  },
  token_usage: [{ hour: "2026-02-18 10:00:00", input_tokens: 1000, output_tokens: 500 }],
  cost_usage: [{ hour: "2026-02-18 10:00:00", cost: 0.5 }],
  message_usage: [{ hour: "2026-02-18 10:00:00", count: 5 }],
  cost_by_model: [],
  recent_activity: [
    { id: "msg-12345678", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok" },
  ],
  has_data: true,
};

describe("Overview - trend badges and status display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAgentName = "test-agent";
  });

  it("does not render trend badge when trend_pct is 0", async () => {
    const zeroTrendData = {
      ...overviewData,
      summary: {
        ...overviewData.summary,
        tokens_today: { value: 50000, trend_pct: 0 },
        cost_today: { value: 3.5, trend_pct: 0 },
        messages: { value: 42, trend_pct: 0 },
      },
    };
    mockGetOverview.mockResolvedValue(zeroTrendData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$3.50");
    });
    const trendBadges = container.querySelectorAll(".trend");
    expect(trendBadges.length).toBe(0);
  });

  it("renders rate_limited status as a link to the limits page", async () => {
    const rateLimitedData = {
      ...overviewData,
      recent_activity: [{
        id: "msg-ratelimit1",
        timestamp: "2026-02-18T10:00:00Z",
        agent_name: "test-agent",
        model: null,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: null,
        cost: null,
        status: "rate_limited",
      }],
    };
    mockGetOverview.mockResolvedValue(rateLimitedData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("rate_limited");
    });
    const link = container.querySelector('.status-badge--rate_limited a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toContain("/limits");
  });

  it("renders routing tier badge when routing_tier is set", async () => {
    const routedData = {
      ...overviewData,
      recent_activity: [{
        ...overviewData.recent_activity[0],
        routing_tier: "complex",
      }],
    };
    mockGetOverview.mockResolvedValue(routedData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const tierBadge = container.querySelector(".tier-badge--complex");
      expect(tierBadge).not.toBeNull();
      expect(tierBadge?.textContent).toBe("complex");
    });
  });

  it("renders negative trend with down class", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const downTrend = container.querySelector(".trend--down");
      expect(downTrend).not.toBeNull();
      expect(downTrend?.textContent).toContain("-5%");
    });
  });

  it("renders positive trend with up class and plus sign", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      const upTrend = container.querySelector(".trend--up");
      expect(upTrend).not.toBeNull();
      expect(upTrend?.textContent).toContain("+12%");
    });
  });

  it("renders status-specific class on status badge", async () => {
    mockGetOverview.mockResolvedValue(overviewData);
    const { container } = render(() => <Overview />);
    await vi.waitFor(() => {
      expect(container.querySelector(".status-badge--ok")).not.toBeNull();
    });
  });
});
