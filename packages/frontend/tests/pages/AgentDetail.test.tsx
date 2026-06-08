import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";

// Hoisted mutable state so individual tests can override pathname
let mockPathname = "/agents/my-agent";
const mockParams = { agentName: "my-agent" };

vi.mock("@solidjs/router", () => ({
  useParams: () => mockParams,
  useLocation: () => ({ pathname: mockPathname }),
  A: (props: any) => (
    <a
      href={props.href}
      role={props.role}
      aria-selected={props["aria-selected"]}
      class={[props.class, props.classList?.["panel__tab--active"] ? "panel__tab--active" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {props.children}
    </a>
  ),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

vi.mock("../../src/services/agent-platform-store.js", () => ({
  agentPlatformIcon: () => undefined,
}));

// Default: no resolved display name (falls back to decoded slug)
let mockAgentDisplayName: string | null = null;
vi.mock("../../src/services/agent-display-name.js", () => ({
  agentDisplayName: () => mockAgentDisplayName,
}));

import AgentDetail from "../../src/pages/AgentDetail";

describe("AgentDetail", () => {
  beforeEach(() => {
    mockPathname = "/agents/my-agent";
    mockParams.agentName = "my-agent";
    mockAgentDisplayName = null;
  });

  it("renders the page title with the agent name", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("title")?.textContent).toBe("my-agent | Manifest");
  });

  it("renders a back-link to /agents", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const backLink = container.querySelector('a[href="/agents"]') as HTMLAnchorElement;
    expect(backLink).not.toBeNull();
    expect(backLink.textContent).toContain("Agents");
  });

  it("does not render an h1 heading in the agent detail body", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("h1")).toBeNull();
  });

  it("renders a tablist with exactly 4 tabs", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    const tabs = tablist!.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(4);
  });

  it("renders tabs labeled Overview, Routing, Limits, Settings in order", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    const labels = Array.from(tabs).map((t) => t.textContent);
    expect(labels).toEqual(["Overview", "Routing", "Limits", "Settings"]);
  });

  it("Overview tab links to the agent root path", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[0].getAttribute("href")).toBe("/agents/my-agent");
  });

  it("Routing tab links to /agents/:name/routing", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[1].getAttribute("href")).toBe("/agents/my-agent/routing");
  });

  it("Guardrails tab links to /agents/:name/guardrails", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[2].getAttribute("href")).toBe("/agents/my-agent/guardrails");
  });

  it("Settings tab links to /agents/:name/settings", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[3].getAttribute("href")).toBe("/agents/my-agent/settings");
  });

  it("marks Overview tab active when pathname is the agent root", () => {
    mockPathname = "/agents/my-agent";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
    expect(tabs[2].getAttribute("aria-selected")).toBe("false");
    expect(tabs[3].getAttribute("aria-selected")).toBe("false");
  });

  it("marks Overview tab active when pathname is /overview", () => {
    mockPathname = "/agents/my-agent/overview";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("marks Routing tab active when pathname is /routing", () => {
    mockPathname = "/agents/my-agent/routing";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("marks Guardrails tab active when pathname is /guardrails", () => {
    mockPathname = "/agents/my-agent/guardrails";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
  });

  it("marks Settings tab active when pathname starts with /settings", () => {
    mockPathname = "/agents/my-agent/settings/advanced";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[3].getAttribute("aria-selected")).toBe("true");
  });

  it("renders children inside the shell", () => {
    const { container } = render(() => (
      <AgentDetail>
        <div data-testid="child-content">Tab content</div>
      </AgentDetail>
    ));
    expect(container.querySelector('[data-testid="child-content"]')).not.toBeNull();
  });

  it("decodes URL-encoded agent names in title", () => {
    mockParams.agentName = "my%20agent";
    mockPathname = "/agents/my%20agent";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("title")?.textContent).toBe("my agent | Manifest");
    expect(container.querySelector("h1")).toBeNull();
  });

  it("does not render a platform icon", () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("img")).toBeNull();
  });

  it("applies panel__tab--active class to the active tab", () => {
    mockPathname = "/agents/my-agent/routing";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[1].className).toContain("panel__tab--active");
    expect(tabs[0].className).not.toContain("panel__tab--active");
  });

  it("uses resolved display name in title when agentDisplayName is set", () => {
    mockAgentDisplayName = "My Cool Agent";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("title")?.textContent).toBe("My Cool Agent | Manifest");
  });

  it("does not render an h1 when agentDisplayName is set", () => {
    mockAgentDisplayName = "My Cool Agent";
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("h1")).toBeNull();
  });

  it("falls back to decoded slug in title when agentDisplayName is null", () => {
    mockAgentDisplayName = null;
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("title")?.textContent).toBe("my-agent | Manifest");
  });

  it("does not render an h1 when agentDisplayName is null", () => {
    mockAgentDisplayName = null;
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector("h1")).toBeNull();
  });
});

describe("AgentDetail platform icon removal", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("never renders a platform icon even when agentPlatformIcon returns a URL", async () => {
    vi.doMock("../../src/services/agent-platform-store.js", () => ({
      agentPlatformIcon: () => "/icons/robot.svg",
    }));
    vi.doMock("../../src/services/agent-display-name.js", () => ({
      agentDisplayName: () => null,
    }));
    vi.doMock("@solidjs/router", () => ({
      useParams: () => ({ agentName: "my-agent" }),
      useLocation: () => ({ pathname: "/agents/my-agent" }),
      A: (props: any) => <a href={props.href} role={props.role}>{props.children}</a>,
    }));
    vi.doMock("@solidjs/meta", () => ({
      Title: (props: any) => <title>{props.children}</title>,
    }));

    const { default: AgentDetailNoIcon } = await import("../../src/pages/AgentDetail");
    const { container } = render(() => <AgentDetailNoIcon>{null}</AgentDetailNoIcon>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("h1")).toBeNull();
  });
});
