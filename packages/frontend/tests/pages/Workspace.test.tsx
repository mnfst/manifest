import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockNavigate = vi.fn();
vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockGetAgents = vi.fn();
const mockCreateAgent = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
  createAgent: (...args: unknown[]) => mockCreateAgent(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/services/formatters.js", () => ({
  formatNumber: (v: number) => String(v),
  formatCost: (v: number) => `$${v.toFixed(2)}`,
}));

vi.mock("../../src/components/Sparkline.jsx", () => ({
  default: () => <div data-testid="sparkline" />,
}));

let mockCheckLocalMode = vi.fn().mockResolvedValue(false);
vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: (...args: unknown[]) => mockCheckLocalMode(...args),
}));

import Workspace from "../../src/pages/Workspace";

describe("Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLocalMode = vi.fn().mockResolvedValue(false);
    mockGetAgents.mockResolvedValue({
      agents: [
        { agent_name: "demo-agent", display_name: "Demo Agent", message_count: 42, last_active: "2024-01-01", total_cost: 5.5, total_tokens: 15000, sparkline: [1, 2, 3] },
      ],
    });
    mockCreateAgent.mockResolvedValue({ agent: { name: "new-agent", display_name: "new-agent" }, apiKey: "test-key" });
  });

  it("renders My Agents heading", async () => {
    render(() => <Workspace />);
    expect(screen.getByText("My Agents")).toBeDefined();
  });

  it("renders Connect Agent button", () => {
    render(() => <Workspace />);
    const buttons = screen.getAllByText("Connect Agent");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders agent cards with display name when data loads", async () => {
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Demo Agent");
    });
  });

  it("shows agent stats", async () => {
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$5.50");
      expect(container.textContent).toContain("15000");
    });
  });

  it("shows empty state when no agents", async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No agents yet");
    });
  });

  it("shows loading skeleton", () => {
    mockGetAgents.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <Workspace />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("opens create agent modal on Connect Agent click", () => {
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    expect(container.querySelector(".modal-card__input")).not.toBeNull();
  });

  it("agents link to agent detail page", async () => {
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      const link = container.querySelector('a[href="/agents/demo-agent"]');
      expect(link).not.toBeNull();
    });
  });

  it("shows agent card stat labels", async () => {
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Tokens");
      expect(container.textContent).toContain("Messages");
      expect(container.textContent).toContain("Cost");
    });
  });

  it("shows message count in agent card", async () => {
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("42");
    });
  });

  it("creates agent when form submitted", async () => {
    mockCreateAgent.mockResolvedValue({ apiKey: "test-key" });
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new-agent" } });
    const createBtn = screen.getByText("Create");
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith("new-agent");
    });
  });

  it("create button is disabled when name is empty", () => {
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    const createBtn = screen.getByText("Create") as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it("shows modal dialog title", () => {
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    expect(container.textContent).toContain("Give your agent a name");
  });

  it("shows breadcrumb text", () => {
    const { container } = render(() => <Workspace />);
    expect(container.textContent).toContain("All agents");
  });

  it("shows connect button in empty state", async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Connect your first agent");
    });
  });

  describe("local mode", () => {
    it("redirects to /agents/local-agent in local mode", async () => {
      mockCheckLocalMode = vi.fn().mockResolvedValue(true);
      render(() => <Workspace />);
      await vi.waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/agents/local-agent", { replace: true });
      });
    });

    it("does not redirect in cloud mode", async () => {
      mockCheckLocalMode = vi.fn().mockResolvedValue(false);
      render(() => <Workspace />);
      await vi.waitFor(() => {
        expect(mockCheckLocalMode).toHaveBeenCalled();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
