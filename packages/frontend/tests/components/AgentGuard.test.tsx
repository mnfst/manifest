import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  useLocation: () => ({ pathname: "/agents/test-agent", state: null }),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

const mockGetAgents = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgents: () => mockGetAgents(),
}));

const mockIsLocalMode = vi.fn(() => false);
const mockCheckLocalMode = vi.fn(() => Promise.resolve(false));
vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => mockIsLocalMode(),
  checkLocalMode: () => mockCheckLocalMode(),
}));

vi.mock("../../src/components/ErrorState.jsx", () => ({
  default: (props: any) => <div data-testid="error-state">{props.title || "Error"}</div>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

import AgentGuard from "../../src/components/AgentGuard";

describe("AgentGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLocalMode.mockReturnValue(false);
    mockCheckLocalMode.mockResolvedValue(false);
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

  it("renders nothing while mode is loading", () => {
    mockCheckLocalMode.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => (
      <AgentGuard>
        <div data-testid="child">Child</div>
      </AgentGuard>
    ));
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
  });

  it("calls getAgents in cloud mode", async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: "test-agent" }] });
    render(() => <AgentGuard><div>Child</div></AgentGuard>);
    await vi.waitFor(() => {
      expect(mockGetAgents).toHaveBeenCalled();
    });
  });

  it("renders children immediately in local mode without calling getAgents", async () => {
    mockIsLocalMode.mockReturnValue(true);
    mockCheckLocalMode.mockResolvedValue(true);
    render(() => (
      <AgentGuard>
        <div data-testid="child">Child content</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(screen.getByTestId("child")).toBeDefined();
    });
    expect(mockGetAgents).not.toHaveBeenCalled();
  });
});
