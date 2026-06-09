import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

// AgentOverview is the canonical name for the agent-scoped overview page.
// It re-exports Overview, so we verify the rename doesn't break rendering.
// Overview itself is mocked here to avoid the full dependency tree; the
// comprehensive behavioral tests live in Overview.test.tsx.

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  useLocation: () => ({ pathname: "/harnesses/test-agent", state: null }),
  useNavigate: () => vi.fn(),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

// Mock the Overview module that AgentOverview re-exports.
// This prevents the deep dependency chain (which requires manifest-shared to be
// built) from being triggered in tests. Behavioral coverage is in Overview.test.tsx.
vi.mock("../../src/pages/Overview.js", () => ({
  default: () => <div data-testid="overview-stub">AgentOverview content</div>,
}));

import AgentOverview from "../../src/pages/AgentOverview";

describe("AgentOverview", () => {
  it("renders the component provided by the re-export", () => {
    const { container } = render(() => <AgentOverview />);
    expect(container.querySelector('[data-testid="overview-stub"]')).not.toBeNull();
  });

  it("has the same default export as Overview", async () => {
    const { default: AgentOverviewExport } = await import("../../src/pages/AgentOverview");
    const { default: OverviewExport } = await import("../../src/pages/Overview");
    // Both modules export the same component (the re-export works correctly).
    expect(AgentOverviewExport).toBe(OverviewExport);
  });
});
