import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useLocation: () => ({ pathname: "/agents/test-agent" }),
}));

vi.mock("../../src/services/routing.js", () => ({
  useAgentName: () => () => "test-agent",
  agentPath: (name: string, sub: string) => name ? `/agents/${name}${sub}` : "/",
}));

import Sidebar from "../../src/components/Sidebar";

describe("Sidebar", () => {
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

  it("renders Routing link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Routing")).toBeDefined();
  });
});
