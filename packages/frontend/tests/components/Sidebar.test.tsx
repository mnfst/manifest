import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

let mockPathname = "/overview";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => {
    // Access classList to trigger coverage of classList expressions
    const cl = props.classList;
    const classes = [props.class || ""];
    if (cl) {
      for (const [key, val] of Object.entries(cl)) {
        if (val) classes.push(key);
      }
    }
    return (
      <a href={props.href} class={classes.join(" ").trim()} aria-current={props["aria-current"]}>
        {props.children}
      </a>
    );
  },
  useLocation: () => ({ get pathname() { return mockPathname; } }),
}));

import Sidebar from "../../src/components/Sidebar";

beforeEach(() => {
  mockPathname = "/overview";
});

describe("Sidebar — global nav (agent route)", () => {
  beforeEach(() => {
    mockPathname = "/agents/test-agent";
  });

  it("renders Overview link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Overview")).toBeDefined();
  });

  it("renders Messages link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Messages")).toBeDefined();
  });

  it("renders Agents link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Agents")).toBeDefined();
  });

  it("renders provider section links", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("PROVIDERS")).toBeDefined();
    expect(screen.getByText("Subscriptions")).toBeDefined();
    expect(screen.getByText("BYOK")).toBeDefined();
    expect(screen.getByText("Local")).toBeDefined();
  });

  it("does not render MONITORING section on agent route", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).not.toContain("MONITORING");
  });

  it("does not render MANAGE section on agent route", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).not.toContain("MANAGE");
  });

  it("does not render RESOURCES section on agent route", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).not.toContain("RESOURCES");
  });

  it("links point to global routes, not agent-scoped routes", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/overview"]')).not.toBeNull();
    expect(container.querySelector('a[href="/messages"]')).not.toBeNull();
    expect(container.querySelector('a[href="/providers/subscriptions"]')).not.toBeNull();
    expect(container.querySelector('a[href="/providers/byok"]')).not.toBeNull();
    expect(container.querySelector('a[href="/providers/local"]')).not.toBeNull();
    expect(container.querySelector('a[href="/agents"]')).not.toBeNull();
  });

  it("marks Agents link active on /agents/:name path", () => {
    const { container } = render(() => <Sidebar />);
    const agentsLink = container.querySelector('a[href="/agents"]');
    expect(agentsLink?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Agents link active on /agents/:name/routing sub-path", () => {
    mockPathname = "/agents/test-agent/routing";
    const { container } = render(() => <Sidebar />);
    const agentsLink = container.querySelector('a[href="/agents"]');
    expect(agentsLink?.getAttribute("aria-current")).toBe("page");
  });
});

describe("Sidebar — global nav (global route)", () => {
  it("renders Overview link in global mode", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Overview")).toBeDefined();
  });

  it("renders Messages link in global mode", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Messages")).toBeDefined();
  });

  it("renders Agents link pointing to /agents", () => {
    const { container } = render(() => <Sidebar />);
    const agentsLink = container.querySelector('a[href="/agents"]');
    expect(agentsLink).not.toBeNull();
    expect(agentsLink?.textContent).toContain("Agents");
  });

  it("marks provider links active on provider pages", () => {
    mockPathname = "/providers/byok";
    const { container } = render(() => <Sidebar />);
    const byokLink = container.querySelector('a[href="/providers/byok"]');
    expect(byokLink?.getAttribute("aria-current")).toBe("page");
  });

  it("does not render MONITORING section in global mode", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).not.toContain("MONITORING");
  });

  it("marks Overview link active on /overview path", () => {
    const { container } = render(() => <Sidebar />);
    const overviewLink = container.querySelector('a[href="/overview"]');
    expect(overviewLink?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Messages link active on /messages path", () => {
    mockPathname = "/messages";
    const { container } = render(() => <Sidebar />);
    const messagesLink = container.querySelector('a[href="/messages"]');
    expect(messagesLink?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Agents link active on /agents path", () => {
    mockPathname = "/agents";
    const { container } = render(() => <Sidebar />);
    const agentsLink = container.querySelector('a[href="/agents"]');
    expect(agentsLink?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark Overview active when on /messages", () => {
    mockPathname = "/messages";
    const { container } = render(() => <Sidebar />);
    const overviewLink = container.querySelector('a[href="/overview"]');
    expect(overviewLink?.getAttribute("aria-current")).not.toBe("page");
  });
});

describe("Sidebar — identical in agent and global mode", () => {
  it("renders the same links on /overview and /agents/:name", () => {
    mockPathname = "/overview";
    const { container: globalContainer } = render(() => <Sidebar />);
    const globalLinks = Array.from(globalContainer.querySelectorAll("a.sidebar__link")).map(
      (a) => a.getAttribute("href"),
    );

    mockPathname = "/agents/test-agent";
    const { container: agentContainer } = render(() => <Sidebar />);
    const agentLinks = Array.from(agentContainer.querySelectorAll("a.sidebar__link")).map(
      (a) => a.getAttribute("href"),
    );

    expect(agentLinks).toEqual(globalLinks);
    expect(globalLinks).toEqual([
      "/overview",
      "/messages",
      "/providers/subscriptions",
      "/providers/byok",
      "/providers/local",
      "/agents",
      "/playground",
    ]);
  });
});

describe("Sidebar — structure and interaction", () => {
  it("has nav element with aria-label", () => {
    const { container } = render(() => <Sidebar />);
    const nav = container.querySelector("nav.sidebar");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Agent navigation");
  });

  it("applies the mobile open class", () => {
    const { container } = render(() => <Sidebar mobileOpen />);
    const nav = container.querySelector("nav.sidebar");
    expect(nav?.classList.contains("sidebar--mobile-open")).toBe(true);
  });

  it("calls onNavigate when a sidebar link is clicked", async () => {
    const onNavigate = vi.fn();
    const { container } = render(() => <Sidebar onNavigate={onNavigate} />);
    const link = container.querySelector("a.sidebar__link");

    expect(link).not.toBeNull();
    link!.addEventListener("click", (event) => event.preventDefault(), { once: true });

    await fireEvent.click(link!);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("renders Feedback section", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Feedback")).toBeDefined();
  });

  it("shows feedback hint text", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).toContain("Share ideas or report bugs");
  });

  it("feedback link is external with correct attributes", () => {
    const { container } = render(() => <Sidebar />);
    const feedbackLink = container.querySelector("a.sidebar__feedback") as HTMLAnchorElement;
    expect(feedbackLink).not.toBeNull();
    expect(feedbackLink.target).toBe("_blank");
    expect(feedbackLink.rel).toContain("noopener");
  });
});

describe("Sidebar — active state via isGlobalActive prefix matching", () => {
  it("marks /agents active on /agents sub-path /agents/foo/routing", () => {
    mockPathname = "/agents/foo/routing";
    const { container } = render(() => <Sidebar />);
    const agentsLink = container.querySelector('a[href="/agents"]');
    expect(agentsLink?.getAttribute("aria-current")).toBe("page");
  });

  it("marks /agents active on /agents/foo (no trailing slash)", () => {
    mockPathname = "/agents/foo";
    const { container } = render(() => <Sidebar />);
    const agentsLink = container.querySelector('a[href="/agents"]');
    expect(agentsLink?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark /overview active when on /agents", () => {
    mockPathname = "/agents";
    const { container } = render(() => <Sidebar />);
    const overviewLink = container.querySelector('a[href="/overview"]');
    expect(overviewLink?.getAttribute("aria-current")).not.toBe("page");
  });

  it("marks /overview active only on exact /overview path", () => {
    mockPathname = "/overview";
    const { container } = render(() => <Sidebar />);
    const overviewLink = container.querySelector('a[href="/overview"]');
    expect(overviewLink?.getAttribute("aria-current")).toBe("page");
  });
});
