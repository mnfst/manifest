import { describe, it, expect, vi, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

let mockAgentName: string | null = "test-agent";
let mockPathname = "/overview";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => {
    const cl = props.classList;
    const classes = [props.class || ""];
    if (cl) {
      for (const [key, val] of Object.entries(cl)) {
        if (val) classes.push(key);
      }
    }
    return (
      <a
        href={props.href}
        class={classes.join(" ").trim()}
        aria-current={props["aria-current"]}
      >
        {props.children}
      </a>
    );
  },
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock("../../src/services/routing.js", () => ({
  useAgentName: () => () => mockAgentName,
  agentPath: (name: string, sub: string) =>
    name ? `/agents/${name}${sub}` : "/",
}));

vi.mock("../../src/services/api.js", () => ({
  getAgents: async () => [
    { agent_name: "test-agent", display_name: "Test Agent", agent_platform: "openclaw", agent_category: null },
  ],
}));

vi.mock("../../src/services/sse.js", () => ({
  agentPing: () => 0,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({ data: { user: { name: "Test User" } } }),
  },
}));

vi.mock("manifest-shared", () => ({
  platformIcon: () => null,
}));

vi.mock("../../src/components/AddAgentModal.jsx", () => ({
  default: () => null,
}));

import Sidebar from "../../src/components/Sidebar";

describe("Sidebar top-level links", () => {
  beforeAll(() => {
    mockPathname = "/overview";
    mockAgentName = "test-agent";
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

  it("Overview href is /overview", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/overview"]')).not.toBeNull();
  });

  it("Messages href is /messages", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/messages"]')).not.toBeNull();
  });

  it("Agents href is /agents", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/agents"]')).not.toBeNull();
  });
});

describe("Sidebar PROVIDERS section", () => {
  beforeAll(() => {
    mockPathname = "/overview";
  });

  it("renders PROVIDERS section label", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("PROVIDERS")).toBeDefined();
  });

  it("renders Subscriptions link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Subscriptions")).toBeDefined();
  });

  it("renders BYOK link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("BYOK")).toBeDefined();
  });

  it("renders Local link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Local")).toBeDefined();
  });

  it("Subscriptions href is /providers/subscriptions", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/providers/subscriptions"]')).not.toBeNull();
  });

  it("BYOK href is /providers/byok", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/providers/byok"]')).not.toBeNull();
  });

  it("Local href is /providers/local", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/providers/local"]')).not.toBeNull();
  });
});

describe("Sidebar navigation shell", () => {
  beforeAll(() => {
    mockPathname = "/overview";
    mockAgentName = "test-agent";
  });

  it("does not render the legacy AGENTS section label", () => {
    render(() => <Sidebar />);
    expect(screen.queryByText("AGENTS")).toBeNull();
  });

  it("has nav element with correct aria-label", () => {
    const { container } = render(() => <Sidebar />);
    const nav = container.querySelector("nav.sidebar");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Navigation");
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
});

describe("Sidebar workspace title", () => {
  beforeAll(() => {
    mockPathname = "/overview";
  });

  it("does not render the legacy workspace title", () => {
    render(() => <Sidebar />);
    expect(screen.queryByText("Test's workspace")).toBeNull();
  });
});

describe("Sidebar feedback section", () => {
  beforeAll(() => {
    mockPathname = "/overview";
  });

  it("renders Feedback text", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Feedback")).toBeDefined();
  });

  it("feedback link is external with correct attributes", () => {
    const { container } = render(() => <Sidebar />);
    const feedbackLink = container.querySelector(
      "a.sidebar__feedback",
    ) as HTMLAnchorElement;
    expect(feedbackLink).not.toBeNull();
    expect(feedbackLink.target).toBe("_blank");
    expect(feedbackLink.rel).toContain("noopener");
  });
});

describe("Sidebar active states", () => {
  it("marks Overview link as active on /overview", () => {
    mockPathname = "/overview";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/overview"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Messages link as active on /messages", () => {
    mockPathname = "/messages";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/messages"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Subscriptions link as active on /providers/subscriptions", () => {
    mockPathname = "/providers/subscriptions";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/providers/subscriptions"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks BYOK link as active on /providers/byok", () => {
    mockPathname = "/providers/byok";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/providers/byok"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Local link as active on /providers/local", () => {
    mockPathname = "/providers/local";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/providers/local"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Agents link as active on /agents", () => {
    mockPathname = "/agents";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/agents"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Agents link as active on agent detail pages", () => {
    mockPathname = "/agents/test-agent";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/agents"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark Overview as active on /messages", () => {
    mockPathname = "/messages";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/overview"]');
    expect(link?.getAttribute("aria-current")).toBeFalsy();
  });
});

describe("Sidebar legacy agents controls", () => {
  beforeAll(() => {
    mockPathname = "/overview";
    mockAgentName = "test-agent";
  });

  it("does not show collapse button for a removed AGENTS section", () => {
    const { container } = render(() => <Sidebar />);
    const caretBtn = container.querySelector("button.sidebar__section-caret");
    expect(caretBtn).toBeNull();
  });

  it("does not render legacy agent links", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/agents/test-agent"]')).toBeNull();
  });

  it("does not show add agent button in the sidebar", () => {
    const { container } = render(() => <Sidebar />);
    const addBtn = container.querySelector("button.sidebar__section-add");
    expect(addBtn).toBeNull();
  });
});
