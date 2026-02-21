import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@solidjs/testing-library";

let mockAgentName: string | null = "test-agent";
let mockPathname = "/agents/test-agent";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class} aria-current={props["aria-current"]}>{props.children}</a>,
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock("../../src/services/routing.js", () => ({
  useAgentName: () => () => mockAgentName,
  agentPath: (name: string, sub: string) => name ? `/agents/${name}${sub}` : "/",
}));

import Sidebar from "../../src/components/Sidebar";

describe("Sidebar with agent", () => {
  beforeAll(() => {
    mockAgentName = "test-agent";
    mockPathname = "/agents/test-agent";
  });

  it("renders MONITORING section", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("MONITORING")).toBeDefined();
  });

  it("renders Overview link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Overview")).toBeDefined();
  });

  it("renders Messages link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Messages")).toBeDefined();
  });

  it("renders MANAGE section", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("MANAGE")).toBeDefined();
  });

  it("renders Settings link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders Notifications link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Notifications")).toBeDefined();
  });

  it("renders RESOURCES section", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("RESOURCES")).toBeDefined();
  });

  it("renders Help link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Help")).toBeDefined();
  });

  it("renders Model Prices link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Model Prices")).toBeDefined();
  });

  it("renders Feedback section", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Feedback")).toBeDefined();
  });

  it("has correct link hrefs for agent routes", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/agents/test-agent"]')).not.toBeNull();
    expect(container.querySelector('a[href="/agents/test-agent/messages"]')).not.toBeNull();
    expect(container.querySelector('a[href="/agents/test-agent/settings"]')).not.toBeNull();
    expect(container.querySelector('a[href="/agents/test-agent/notifications"]')).not.toBeNull();
    expect(container.querySelector('a[href="/agents/test-agent/model-prices"]')).not.toBeNull();
    expect(container.querySelector('a[href="/agents/test-agent/help"]')).not.toBeNull();
  });

  it("marks current page link as active", () => {
    const { container } = render(() => <Sidebar />);
    const overviewLink = container.querySelector('a[href="/agents/test-agent"]');
    expect(overviewLink?.getAttribute("aria-current")).toBe("page");
  });

  it("has nav element with aria-label", () => {
    const { container } = render(() => <Sidebar />);
    const nav = container.querySelector("nav.sidebar");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Agent navigation");
  });

  it("shows feedback hint text", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).toContain("Help us improve Manifest");
  });

  it("feedback link is external with correct attributes", () => {
    const { container } = render(() => <Sidebar />);
    const feedbackLink = container.querySelector("a.sidebar__feedback") as HTMLAnchorElement;
    expect(feedbackLink).not.toBeNull();
    expect(feedbackLink.target).toBe("_blank");
    expect(feedbackLink.rel).toContain("noopener");
  });
});

describe("Sidebar without agent", () => {
  beforeAll(() => {
    mockAgentName = null;
    mockPathname = "/";
  });

  it("renders Agents link when no agent selected", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Agents")).toBeDefined();
  });

  it("does not render MONITORING section when no agent", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).not.toContain("MONITORING");
  });

  it("does not render agent navigation links when no agent", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).not.toContain("Overview");
    expect(container.textContent).not.toContain("Messages");
  });
});
