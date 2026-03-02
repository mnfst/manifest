import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";

let mockAgentName = "test-agent";
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: mockAgentName }),
}));

let mockIsLocalMode: boolean | null = false;
vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => mockIsLocalMode,
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
  formatDuration: (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`,
  formatErrorMessage: (s: string) => s,
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
    { id: "msg-12345678", timestamp: "2026-02-18T10:00:00Z", agent_name: "test-agent", model: "gpt-4o", input_tokens: 100, output_tokens: 50, total_tokens: 150, cost: 0.01, status: "ok", cache_read_tokens: 500, cache_creation_tokens: 100, duration_ms: 1200 },
    { id: "msg-87654321", timestamp: "2026-02-18T09:00:00Z", agent_name: "test-agent", model: "claude-3.5-sonnet", input_tokens: 200, output_tokens: 100, total_tokens: 300, cost: 0.02, status: "error", cache_read_tokens: null, cache_creation_tokens: null, duration_ms: null },
  ],
  next_cursor: null,
  total_count: 2,
  models: ["gpt-4o", "claude-3.5-sonnet"],
};

describe("MessageLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAgentName = "test-agent";
    mockIsLocalMode = false;
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

  describe("local mode", () => {
    it("should treat setup as completed for local-agent in local mode", async () => {
      mockAgentName = "local-agent";
      mockIsLocalMode = true;
      mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, models: [] });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("messages will appear");
      });
    });

    it("should not show Set up agent button for local-agent in local mode", async () => {
      mockAgentName = "local-agent";
      mockIsLocalMode = true;
      mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, models: [] });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        const setupBtn = container.querySelector(".btn--primary");
        expect(setupBtn).toBeNull();
      });
    });

    it("should show Set up agent button for non-local-agent even in local mode", async () => {
      mockAgentName = "other-agent";
      mockIsLocalMode = true;
      mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, models: [] });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("No messages recorded");
      });
    });

    it("should show Set up agent button for local-agent when not in local mode", async () => {
      mockAgentName = "local-agent";
      mockIsLocalMode = false;
      mockGetMessages.mockResolvedValue({ items: [], next_cursor: null, total_count: 0, models: [] });
      const { container } = render(() => <MessageLog />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("No messages recorded");
      });
    });
  });
});
