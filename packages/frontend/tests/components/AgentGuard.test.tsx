import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

// Reactive agent param so tests can simulate navigating between agents while
// AgentGuard stays mounted (the resource is keyed on this).
const [agentNameParam, setAgentNameParam] = createSignal("test-agent");
vi.mock("@solidjs/router", () => ({
  useParams: () => ({
    get agentName() {
      return agentNameParam();
    },
  }),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

const mockGetAgents = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgents: () => mockGetAgents(),
}));

const mockSetAgentDisplayName = vi.fn();
vi.mock("../../src/services/agent-display-name.js", () => ({
  setAgentDisplayName: (...args: unknown[]) => mockSetAgentDisplayName(...args),
}));

const mockIsRecentlyCreated = vi.fn(() => false);
const mockClearRecentAgent = vi.fn();
vi.mock("../../src/services/recent-agents.js", () => ({
  isRecentlyCreated: (...args: unknown[]) => mockIsRecentlyCreated(...args),
  clearRecentAgent: (...args: unknown[]) => mockClearRecentAgent(...args),
}));

vi.mock("../../src/components/ErrorState.jsx", () => ({
  default: (props: any) => (
    <div data-testid="error-state" data-error={String(props.error ?? "")}>
      {props.title || "Error"}
      <button data-testid="retry" onClick={() => props.onRetry?.()}>Retry</button>
    </div>
  ),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

import AgentGuard from "../../src/components/AgentGuard";

describe("AgentGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAgentDisplayName.mockClear();
    mockIsRecentlyCreated.mockReturnValue(false);
    mockClearRecentAgent.mockClear();
    setAgentNameParam("test-agent");
  });

  it("renders children when agent exists", async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: "test-agent" }] });
    render(() => (
      <AgentGuard>
        <div data-testid="child">Child content</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(screen.getByTestId("child")).toBeDefined();
    });
  });

  it("renders NotFound inline when agent does not exist", async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: "other-agent" }] });
    const { container } = render(() => (
      <AgentGuard>
        <div data-testid="child">Child</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Page not found");
    });
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
  });

  it("calls getAgents (covers the fetcher path)", async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    render(() => (
      <AgentGuard>
        <div data-testid="child">Child</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(mockGetAgents).toHaveBeenCalled();
    });
  });

  it("renders children when isRecentlyCreated returns true even if agent not in list", async () => {
    mockIsRecentlyCreated.mockReturnValue(true);
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: "other-agent" }] });
    render(() => (
      <AgentGuard>
        <div data-testid="child">Child content</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(screen.getByTestId("child")).toBeDefined();
    });
    expect(mockIsRecentlyCreated).toHaveBeenCalledWith("test-agent");
  });

  it("calls clearRecentAgent when agent is found in the fetched list", async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: "test-agent", display_name: "Test Agent" }] });
    render(() => (
      <AgentGuard>
        <div data-testid="child">Child</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(mockClearRecentAgent).toHaveBeenCalledWith("test-agent");
    });
  });

  it("refetches the agent list when the viewed agent changes", async () => {
    // First load only knows about test-agent; a second agent is created later
    // (e.g. from the sidebar while this guard stays mounted) and must trigger a
    // fresh fetch rather than reusing the stale first-mount list.
    mockGetAgents
      .mockResolvedValueOnce({ agents: [{ agent_name: "test-agent" }] })
      .mockResolvedValueOnce({
        agents: [{ agent_name: "test-agent" }, { agent_name: "new-agent" }],
      });
    mockIsRecentlyCreated.mockImplementation((name: string) => name === "new-agent");

    render(() => (
      <AgentGuard>
        <div data-testid="child">Child content</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(mockGetAgents).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("child")).toBeDefined();
    });

    setAgentNameParam("new-agent");

    await vi.waitFor(() => {
      expect(mockGetAgents).toHaveBeenCalledTimes(2);
    });
    // Children stay mounted through the in-flight refetch (no blank flash) and
    // the freshly fetched list resolves the new agent.
    expect(screen.getByTestId("child")).toBeDefined();
    expect(mockClearRecentAgent).toHaveBeenCalledWith("new-agent");
  });
});
