import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockGetMessages = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
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

vi.mock("../../src/components/SetupModal.jsx", () => ({
  default: () => <div data-testid="setup-modal" />,
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

import MessageLog from "../../src/pages/MessageLog";

const messagesData = {
  items: [
    { id: "msg-12345678", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok" },
    { id: "msg-87654321", timestamp: "2026-02-18T09:00:00Z", agent_name: "test-agent", model: "claude-3.5-sonnet", input_tokens: 200, output_tokens: 100, total_tokens: 300, cost: 0.02, status: "error" },
  ],
  next_cursor: null,
  total_count: 2,
  models: ["gpt-4o", "claude-3.5-sonnet"],
};

describe("MessageLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders Messages heading", () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    expect(screen.getByText("Messages")).toBeDefined();
  });

  it("renders breadcrumb subtitle", () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    expect(screen.getByText("Every message sent and received by your agent")).toBeDefined();
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
      expect(container.textContent).toContain("Time");
      expect(container.textContent).toContain("Cost");
      expect(container.textContent).toContain("Total Tokens");
      expect(container.textContent).toContain("Model");
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
    mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, models: [] });
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No messages recorded");
    });
  });

  it("shows filter controls when data exists", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const selects = container.querySelectorAll('[data-testid="select"]');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows cost range filter inputs", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    const { container } = render(() => <MessageLog />);
    await vi.waitFor(() => {
      const inputs = container.querySelectorAll(".cost-range-filter__input");
      expect(inputs.length).toBe(2);
    });
  });

  it("calls getMessages on mount", async () => {
    mockGetMessages.mockResolvedValue(messagesData);
    render(() => <MessageLog />);
    await vi.waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalled();
    });
  });
});
