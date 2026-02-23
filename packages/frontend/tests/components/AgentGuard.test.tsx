import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";

const mockNavigate = vi.fn();
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/agents/test-agent", state: null }),
}));

const mockGetAgents = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgents: () => mockGetAgents(),
}));

vi.mock("../../src/components/ErrorState.jsx", () => ({
  default: (props: any) => <div data-testid="error-state">{props.title || "Error"}</div>,
}));

import AgentGuard from "../../src/components/AgentGuard";

describe("AgentGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("navigates to 404 when agent does not exist", async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: "other-agent" }] });
    render(() => (
      <AgentGuard>
        <div>Child</div>
      </AgentGuard>
    ));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/404", { replace: true });
    });
  });

  it("renders nothing while loading", () => {
    mockGetAgents.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => (
      <AgentGuard>
        <div data-testid="child">Child</div>
      </AgentGuard>
    ));
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
  });

  it("calls getAgents on mount", async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: "test-agent" }] });
    render(() => <AgentGuard><div>Child</div></AgentGuard>);
    await vi.waitFor(() => {
      expect(mockGetAgents).toHaveBeenCalled();
    });
  });
});
