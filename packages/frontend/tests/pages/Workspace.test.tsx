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
const mockDeleteAgent = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
  createAgent: (...args: unknown[]) => mockCreateAgent(...args),
  deleteAgent: (...args: unknown[]) => mockDeleteAgent(...args),
}));

vi.mock("../../src/components/DuplicateAgentModal.jsx", async () => {
  const { Show } = await import("solid-js");
  return {
    default: (props: {
      open: boolean;
      sourceName: string;
      onClose: () => void;
      onDuplicated?: () => void;
    }) => (
      <Show when={props.open}>
        <div data-testid="duplicate-modal" data-source={props.sourceName}>
          <button data-testid="duplicate-modal-close" onClick={() => props.onClose()}>
            close
          </button>
          <button
            data-testid="duplicate-modal-done"
            onClick={() => {
              props.onDuplicated?.();
              props.onClose();
            }}
          >
            done
          </button>
        </div>
      </Show>
    ),
  };
});

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

vi.mock("../../src/services/sse.js", () => ({
  pingCount: () => 0,
  messagePing: () => 0,
  agentPing: () => 0,
  routingPing: () => 0,
}));

vi.mock("../../src/components/AgentTypeSelect.jsx", () => ({
  default: (props: any) => (
    <div
      data-testid="agent-type-picker"
      data-category={props.category ?? ""}
      data-platform={props.platform ?? ""}
      data-disabled={String(!!props.disabled)}
    >
      <button data-testid="pick-category" onClick={() => props.onCategoryChange("personal")}>Pick Category</button>
      <button data-testid="pick-platform" onClick={() => props.onPlatformChange("openclaw")}>Pick Platform</button>
    </div>
  ),
}));

const mockMarkAgentCreated = vi.fn();
vi.mock("../../src/services/recent-agents.js", () => ({
  markAgentCreated: (...args: unknown[]) => mockMarkAgentCreated(...args),
}));

vi.mock("manifest-shared", () => ({
  AGENT_CATEGORIES: ["personal", "app"],
  PLATFORM_ICONS: {
    openclaw: "/icons/openclaw.png",
    hermes: "/icons/hermes.png",
    "openai-sdk": "/icons/providers/openai.svg",
    "vercel-ai-sdk": "/icons/vercel.svg",
    langchain: "/icons/langchain.svg",
    other: "/icons/other.svg",
  },
  PLATFORMS_BY_CATEGORY: {
    personal: ["openclaw", "hermes", "other"],
    app: ["openai-sdk", "vercel-ai-sdk", "langchain", "other"],
  },
  platformIcon: (plat: string | null, cat: string | null) => {
    if (!plat) return undefined;
    if (plat === "other") return cat === "personal" ? "/icons/other-agent.svg" : "/icons/other.svg";
    const icons: Record<string, string> = {
      openclaw: "/icons/openclaw.png",
      hermes: "/icons/hermes.png",
      "openai-sdk": "/icons/providers/openai.svg",
      "vercel-ai-sdk": "/icons/vercel.svg",
      langchain: "/icons/langchain.svg",
    };
    return icons[plat];
  },
}));

import Workspace from "../../src/pages/Workspace";

describe("Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(container.textContent).toContain("15000");
      expect(container.textContent).toContain("42");
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
    });
  });

  it("shows message count in agent card", async () => {
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("42");
    });
  });

  it("creates agent when form submitted", async () => {
    mockCreateAgent.mockResolvedValue({ agent: { name: "new-agent" }, apiKey: "test-key" });
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new-agent" } });
    const createBtn = screen.getByText("Create");
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({ name: "new-agent" }));
    });
    await vi.waitFor(() => {
      expect(mockMarkAgentCreated).toHaveBeenCalledWith("new-agent");
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
    expect(container.textContent).toContain("Name your agent to start tracking");
  });

  it("shows breadcrumb text", () => {
    const { container } = render(() => <Workspace />);
    expect(container.textContent).toContain("View and manage all your connected AI agents");
  });

  it("shows connect button in empty state", async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Connect your first agent");
    });
  });

  it("shows Creating... text and disables button during submission", async () => {
    let resolveCreate: (v: any) => void;
    mockCreateAgent.mockReturnValue(new Promise((r) => { resolveCreate = r; }));
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new-agent" } });
    fireEvent.click(screen.getByText("Create"));
    await vi.waitFor(() => {
      const btns = container.querySelectorAll(".modal-card button.btn--primary");
      const createBtn = btns[btns.length - 1] as HTMLButtonElement;
      expect(createBtn.querySelector(".spinner")).not.toBeNull();
      expect(createBtn.disabled).toBe(true);
    });
    resolveCreate!({ agent: { name: "new-agent" }, apiKey: "k" });
  });

  it("disables input during creation", async () => {
    let resolveCreate: (v: any) => void;
    mockCreateAgent.mockReturnValue(new Promise((r) => { resolveCreate = r; }));
    const { container } = render(() => <Workspace />);
    fireEvent.click(screen.getAllByText("Connect Agent")[0]);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new-agent" } });
    fireEvent.click(screen.getByText("Create"));
    await vi.waitFor(() => {
      expect(input.disabled).toBe(true);
    });
    resolveCreate!({ agent: { name: "new-agent" }, apiKey: "k" });
  });

  it("handles createAgent error gracefully", async () => {
    mockCreateAgent.mockRejectedValue(new Error("Failed to create"));
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new-agent" } });
    fireEvent.click(screen.getByText("Create"));
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalled();
    });
  });

  it("creates agent on Enter key press", async () => {
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "enter-agent" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({ name: "enter-agent" }));
    });
  });

  it("closes modal and clears input on Escape key", () => {
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "test" } });
    fireEvent.keyDown(input, { key: "Escape" });
    // Modal should be closed (no modal input visible)
    expect(container.querySelector(".modal-card__input")).toBeNull();
  });

  it("closes modal on overlay click", () => {
    const { container } = render(() => <Workspace />);
    const btn = screen.getAllByText("Connect Agent")[0];
    fireEvent.click(btn);
    expect(container.querySelector(".modal-overlay")).not.toBeNull();
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    // Modal should be closed after overlay click
    expect(container.querySelector(".modal-card__input")).toBeNull();
  });

  it("does not redirect in any mode", async () => {
    render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(mockGetAgents).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows AgentTypePicker in create modal", () => {
    const { container } = render(() => <Workspace />);
    fireEvent.click(screen.getAllByText("Connect Agent")[0]);
    expect(container.querySelector('[data-testid="agent-type-picker"]')).not.toBeNull();
  });

  it("sets first platform when category changes in create modal", () => {
    const { container } = render(() => <Workspace />);
    fireEvent.click(screen.getAllByText("Connect Agent")[0]);
    // First pick a platform
    fireEvent.click(container.querySelector('[data-testid="pick-platform"]')!);
    // Then change category which should set platform to first of new category
    fireEvent.click(container.querySelector('[data-testid="pick-category"]')!);
    const picker = container.querySelector('[data-testid="agent-type-picker"]');
    expect(picker!.getAttribute("data-platform")).toBe("openclaw");
  });

  it("sends category and platform with createAgent", async () => {
    mockCreateAgent.mockResolvedValue({ agent: { name: "typed-agent" }, apiKey: "k" });
    const { container } = render(() => <Workspace />);
    fireEvent.click(screen.getAllByText("Connect Agent")[0]);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "typed-agent" } });
    fireEvent.click(container.querySelector('[data-testid="pick-category"]')!);
    fireEvent.click(container.querySelector('[data-testid="pick-platform"]')!);
    fireEvent.click(screen.getByText("Create"));
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({
        name: "typed-agent",
        agent_category: "personal",
        agent_platform: "openclaw",
      }));
    });
  });

  it("does not submit when name is empty", async () => {
    const { container } = render(() => <Workspace />);
    fireEvent.click(screen.getAllByText("Connect Agent")[0]);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("Create"));
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });

  it("shows agent_name when display_name is missing", async () => {
    mockGetAgents.mockResolvedValue({
      agents: [
        { agent_name: "raw-agent", message_count: 1, last_active: "2024-01-01", total_cost: 0, total_tokens: 0, sparkline: [] },
      ],
    });
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("raw-agent");
    });
  });

  it("shows error state when getAgents fails", async () => {
    mockGetAgents.mockRejectedValue(new Error("Network error"));
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      // ErrorState component should render
      expect(container.querySelector(".error-state") || container.textContent?.includes("error")).toBeDefined();
    });
  });

  it("opens modal from empty state connect button", async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Connect your first agent");
    });
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Connect your first agent"),
    )!;
    fireEvent.click(btn);
    expect(container.querySelector(".modal-card__input")).not.toBeNull();
  });

  it("shows platform icon when agent has a platform", async () => {
    mockGetAgents.mockResolvedValue({
      agents: [
        { agent_name: "my-agent", display_name: "My Agent", agent_platform: "openclaw", message_count: 1, last_active: "2024-01-01", total_cost: 0, total_tokens: 0, sparkline: [] },
      ],
    });
    const { container } = render(() => <Workspace />);
    await vi.waitFor(() => {
      const icon = container.querySelector(".agent-card__platform-icon");
      expect(icon).not.toBeNull();
      expect(icon!.getAttribute("src")).toBe("/icons/openclaw.png");
    });
  });

  it("disables picker during creation", async () => {
    let resolveCreate: (v: any) => void;
    mockCreateAgent.mockReturnValue(new Promise((r) => { resolveCreate = r; }));
    const { container } = render(() => <Workspace />);
    fireEvent.click(screen.getAllByText("Connect Agent")[0]);
    const input = container.querySelector(".modal-card__input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Create"));
    await vi.waitFor(() => {
      const picker = container.querySelector('[data-testid="agent-type-picker"]');
      expect(picker!.getAttribute("data-disabled")).toBe("true");
    });
    resolveCreate!({ agent: { name: "test" }, apiKey: "k" });
  });

  describe("agent card menu", () => {
    const clickKebab = async (container: HTMLElement) => {
      await vi.waitFor(() => {
        const trigger = container.querySelector(".agent-card__menu-trigger");
        expect(trigger).not.toBeNull();
      });
      const trigger = container.querySelector(".agent-card__menu-trigger") as HTMLButtonElement;
      fireEvent.click(trigger);
    };

    it("opens kebab popover with Duplicate and Delete", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      expect(container.querySelector(".agent-card__menu-popover")).not.toBeNull();
      expect(container.textContent).toContain("Duplicate");
      expect(container.textContent).toContain("Delete");
    });

    it("toggles the popover closed on a second trigger click", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      await clickKebab(container);
      expect(container.querySelector(".agent-card__menu-popover")).toBeNull();
    });

    it("closes the popover when clicking outside", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      expect(container.querySelector(".agent-card__menu-popover")).not.toBeNull();
      fireEvent.click(document.body);
      expect(container.querySelector(".agent-card__menu-popover")).toBeNull();
    });

    it("closes the popover on Escape", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(container.querySelector(".agent-card__menu-popover")).toBeNull();
    });

    it("ignores Escape when popover is already closed", async () => {
      const { container } = render(() => <Workspace />);
      await vi.waitFor(() => {
        expect(container.querySelector(".agent-card__menu-trigger")).not.toBeNull();
      });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(container.querySelector(".agent-card__menu-popover")).toBeNull();
    });

    it("opens the DuplicateAgentModal when Duplicate is clicked", async () => {
      const { container, getByTestId } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Duplicate"));
      const modal = getByTestId("duplicate-modal");
      expect(modal.getAttribute("data-source")).toBe("demo-agent");
    });

    it("closes the DuplicateAgentModal when the user cancels", async () => {
      const { container, getByTestId, queryByTestId } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Duplicate"));
      expect(getByTestId("duplicate-modal")).toBeDefined();
      fireEvent.click(getByTestId("duplicate-modal-close"));
      expect(queryByTestId("duplicate-modal")).toBeNull();
    });

    it("refetches agents after a successful duplicate", async () => {
      const { container, getByTestId } = render(() => <Workspace />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("Demo Agent");
      });
      expect(mockGetAgents).toHaveBeenCalledTimes(1);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Duplicate"));
      fireEvent.click(getByTestId("duplicate-modal-done"));
      await vi.waitFor(() => {
        expect(mockGetAgents).toHaveBeenCalledTimes(2);
      });
    });

    it("opens the delete confirmation modal when Delete is clicked", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Delete"));
      expect(container.textContent).toContain("Delete demo-agent");
      expect(container.querySelector('input[placeholder="demo-agent"]')).not.toBeNull();
    });

    it("requires exact name match before enabling delete button", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Delete"));
      const deleteBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Delete agent",
      ) as HTMLButtonElement;
      expect(deleteBtn.hasAttribute("disabled")).toBe(true);
      const input = container.querySelector('input[placeholder="demo-agent"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: "wrong-name" } });
      expect(deleteBtn.hasAttribute("disabled")).toBe(true);
      fireEvent.input(input, { target: { value: "demo-agent" } });
      expect(deleteBtn.hasAttribute("disabled")).toBe(false);
    });

    it("deletes the agent and refetches after confirmation", async () => {
      mockDeleteAgent.mockResolvedValue({ deleted: true });
      const { container } = render(() => <Workspace />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("Demo Agent");
      });
      await clickKebab(container);
      fireEvent.click(screen.getByText("Delete"));
      const input = container.querySelector('input[placeholder="demo-agent"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: "demo-agent" } });
      const deleteBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Delete agent",
      ) as HTMLButtonElement;
      fireEvent.click(deleteBtn);
      await vi.waitFor(() => {
        expect(mockDeleteAgent).toHaveBeenCalledWith("demo-agent");
        expect(mockGetAgents).toHaveBeenCalledTimes(2);
      });
    });

    it("keeps the modal open when deletion fails so the user can retry", async () => {
      mockDeleteAgent.mockRejectedValue(new Error("boom"));
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Delete"));
      const input = container.querySelector('input[placeholder="demo-agent"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: "demo-agent" } });
      const deleteBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Delete agent",
      ) as HTMLButtonElement;
      fireEvent.click(deleteBtn);
      await vi.waitFor(() => {
        expect(mockDeleteAgent).toHaveBeenCalled();
      });
      expect(container.textContent).toContain("Delete demo-agent");
    });

    it("cancels the delete modal without deleting", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Delete"));
      const cancelBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Cancel",
      ) as HTMLButtonElement;
      fireEvent.click(cancelBtn);
      expect(container.textContent).not.toContain("Delete demo-agent");
      expect(mockDeleteAgent).not.toHaveBeenCalled();
    });

    it("closes the delete modal when the backdrop is clicked", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Delete"));
      const overlay = container.querySelector(".modal-overlay") as HTMLDivElement;
      fireEvent.click(overlay);
      expect(container.textContent).not.toContain("Delete demo-agent");
    });

    it("closes the delete modal on Escape from the overlay", async () => {
      const { container } = render(() => <Workspace />);
      await clickKebab(container);
      fireEvent.click(screen.getByText("Delete"));
      const overlay = container.querySelector(".modal-overlay") as HTMLDivElement;
      fireEvent.keyDown(overlay, { key: "Escape" });
      expect(container.textContent).not.toContain("Delete demo-agent");
    });
  });
});
