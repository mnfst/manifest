import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

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
      <a
        href={props.href}
        class={classes.join(" ").trim()}
        aria-current={props["aria-current"]}
        onClick={props.onClick}
      >
        {props.children}
      </a>
    );
  },
  useLocation: () => ({ get pathname() { return mockPathname; } }),
}));

// getAgents returns the harness list rendered in the in-nav switcher. Each test
// can override the resolved value via mockGetAgents.
const mockGetAgents = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
}));

const mockGetBillingStatus = vi.fn();
vi.mock("../../src/services/api/billing.js", () => ({
  getBillingStatus: (...args: unknown[]) => mockGetBillingStatus(...args),
}));

// Local providers only exist on self-hosted installs; the Sidebar hides the
// Local nav entry in cloud. Default to self-hosted so the legacy link
// assertions keep applying; cloud tests flip the flag.
let mockIsSelfHosted = true;
vi.mock("../../src/services/setup-status.js", () => ({
  checkIsSelfHosted: () => Promise.resolve(mockIsSelfHosted),
}));

// Stub the create-harness modal so the Sidebar test stays isolated from the
// modal's own dependency tree; we only assert that the + button opens it.
const mockAddModal = vi.fn();
vi.mock("../../src/components/AddAgentModal.jsx", async () => {
  const { Show } = await import("solid-js");
  return {
    default: (props: any) => (
      // Read props.open reactively (Show tracks the `when` accessor) so the stub
      // re-renders when the Sidebar toggles addModalOpen.
      <Show
        when={(() => {
          mockAddModal(props.open);
          return props.open;
        })()}
      >
        <div data-testid="add-agent-modal" />
      </Show>
    ),
  };
});

// Stub the AutofixModal for the same reason.
const mockAutofixModal = vi.fn();
vi.mock("../../src/components/AutofixModal.jsx", async () => {
  const { Show } = await import("solid-js");
  return {
    default: (props: any) => (
      <Show
        when={(() => {
          mockAutofixModal(props.open);
          return props.open;
        })()}
      >
        <div data-testid="autofix-modal" />
      </Show>
    ),
  };
});

import Sidebar from "../../src/components/Sidebar";
import { refreshAgents } from "../../src/services/sse";

const SAMPLE_AGENTS = [
  {
    agent_name: "alpha",
    display_name: "Alpha Harness",
    agent_platform: "openclaw",
    agent_category: "personal",
  },
  {
    // No display_name → falls back to agent_name. No platform → no icon.
    agent_name: "beta",
    agent_platform: null,
    agent_category: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = "/overview";
  mockIsSelfHosted = true;
  mockGetAgents.mockResolvedValue({ agents: SAMPLE_AGENTS });
  mockGetBillingStatus.mockResolvedValue({
    enabled: false,
    plan: "free",
    requests: { used: null, limit: null, periodEnd: null },
  });
});

describe("Sidebar — global nav links", () => {
  it("renders Overview link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Overview")).toBeDefined();
  });

  it("renders Requests link", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("Requests")).toBeDefined();
  });

  it("renders provider section links (Local resolves async, self-hosted)", async () => {
    render(() => <Sidebar />);
    expect(screen.getByText("PROVIDERS")).toBeDefined();
    expect(screen.getByText("Subscriptions")).toBeDefined();
    expect(screen.getByText("Usage-based")).toBeDefined();
    await waitFor(() => expect(screen.getByText("Local")).toBeDefined());
  });

  it("hides the Local link in cloud", async () => {
    mockIsSelfHosted = false;
    const { container } = render(() => <Sidebar />);
    // Wait for the self-hosted resource to settle (Usage-based is always present).
    await waitFor(() => expect(screen.getByText("Usage-based")).toBeDefined());
    await Promise.resolve();
    expect(container.querySelector('a[href="/providers/local"]')).toBeNull();
    expect(container.textContent).not.toContain("Local");
  });

  it("renders the HARNESSES section label", () => {
    render(() => <Sidebar />);
    expect(screen.getByText("HARNESSES")).toBeDefined();
  });

  it("renders the TOOLS section with Playground link", () => {
    const { container } = render(() => <Sidebar />);
    expect(screen.getByText("TOOLS")).toBeDefined();
    expect(container.querySelector('a[href="/playground"]')).not.toBeNull();
  });

  it("does not render legacy MONITORING/MANAGE/RESOURCES sections", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.textContent).not.toContain("MONITORING");
    expect(container.textContent).not.toContain("MANAGE");
    expect(container.textContent).not.toContain("RESOURCES");
  });

  it("global links point to global routes", async () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/overview"]')).not.toBeNull();
    expect(container.querySelector('a[href="/messages"]')).not.toBeNull();
    expect(container.querySelector('a[href="/providers/subscriptions"]')).not.toBeNull();
    expect(container.querySelector('a[href="/providers/usage-based"]')).not.toBeNull();
    await waitFor(() =>
      expect(container.querySelector('a[href="/providers/local"]')).not.toBeNull(),
    );
    expect(container.querySelector('a[href="/playground"]')).not.toBeNull();
  });

  it("keeps exactly the expected sidebar__link set (no static Harnesses link)", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() =>
      expect(container.querySelector('a[href="/providers/local"]')).not.toBeNull(),
    );
    const links = Array.from(container.querySelectorAll("a.sidebar__link")).map((a) =>
      a.getAttribute("href"),
    );
    expect(links).toEqual([
      "/overview",
      "/messages",
      "/providers/local",
      "/providers/usage-based",
      "/providers/subscriptions",
      "/playground",
    ]);
    // The collapsible section replaces the old static link — there is no
    // sidebar__link pointing at /harnesses anymore.
    expect(container.querySelector('a.sidebar__link[href="/harnesses"]')).toBeNull();
  });
});

describe("Sidebar — global nav active state", () => {
  it("marks Overview active only on exact /overview path", () => {
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/overview"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Messages active on /messages", () => {
    mockPathname = "/messages";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/messages"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks provider links active on provider pages (prefix match)", () => {
    mockPathname = "/providers/usage-based";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/providers/usage-based"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Subscriptions active on /providers/subscriptions", () => {
    mockPathname = "/providers/subscriptions";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/providers/subscriptions"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Local active on /providers/local", async () => {
    mockPathname = "/providers/local";
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      const link = container.querySelector('a[href="/providers/local"]');
      expect(link?.getAttribute("aria-current")).toBe("page");
    });
  });

  it("marks Playground active on /playground", () => {
    mockPathname = "/playground";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/playground"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark Overview active when on /messages", () => {
    mockPathname = "/messages";
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/overview"]');
    expect(link?.getAttribute("aria-current")).not.toBe("page");
  });
});

describe("Sidebar — harness switcher list", () => {
  it("renders one harness item per agent", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2);
    });
    expect(mockGetAgents).toHaveBeenCalledWith();
  });

  it("links each item to /harnesses/:name and shows the display name", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector('a[href="/harnesses/alpha"]')).not.toBeNull();
    });
    const alpha = container.querySelector('a[href="/harnesses/alpha"]');
    expect(alpha?.textContent).toContain("Alpha Harness");
  });

  it("URL-encodes harness names with special characters in the item href", async () => {
    mockGetAgents.mockResolvedValueOnce({ agents: [{ agent_name: "a/b c", display_name: "A B" }] });
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector("a.sidebar__agent-item")).not.toBeNull();
    });
    const item = container.querySelector("a.sidebar__agent-item");
    expect(item?.getAttribute("href")).toBe("/harnesses/a%2Fb%20c");
  });

  it("falls back to agent_name when display_name is missing", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector('a[href="/harnesses/beta"]')).not.toBeNull();
    });
    const beta = container.querySelector('a[href="/harnesses/beta"]');
    expect(beta?.textContent).toContain("beta");
  });

  it("renders a platform icon for agents that have one and omits it otherwise", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2);
    });
    const alpha = container.querySelector('a[href="/harnesses/alpha"]');
    const beta = container.querySelector('a[href="/harnesses/beta"]');
    // alpha has a known platform → icon present; beta has no platform → no icon.
    expect(alpha?.querySelector("img.sidebar__agent-icon")).not.toBeNull();
    expect(beta?.querySelector("img.sidebar__agent-icon")).toBeNull();
  });

  it("marks the current /harnesses/:name route active", async () => {
    mockPathname = "/harnesses/alpha";
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector('a[href="/harnesses/alpha"]')).not.toBeNull();
    });
    const alpha = container.querySelector('a[href="/harnesses/alpha"]');
    const beta = container.querySelector('a[href="/harnesses/beta"]');
    expect(alpha?.getAttribute("aria-current")).toBe("page");
    expect(alpha?.classList.contains("sidebar__agent-item--active")).toBe(true);
    expect(beta?.getAttribute("aria-current")).not.toBe("page");
  });

  it("excludes Playground agents by calling getAgents() with the default (no includePlayground)", async () => {
    render(() => <Sidebar />);
    await waitFor(() => {
      expect(mockGetAgents).toHaveBeenCalled();
    });
    // Default invocation = playground agents excluded (getAgents(false)).
    expect(mockGetAgents).toHaveBeenCalledWith();
  });

  it("resolves a bare array response (no { agents } wrapper)", async () => {
    mockGetAgents.mockResolvedValue(SAMPLE_AGENTS);
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2);
    });
  });

  it("refetches when a harness is created locally", async () => {
    mockGetAgents.mockResolvedValueOnce({ agents: [] }).mockResolvedValueOnce({
      agents: [{ agent_name: "new-harness", display_name: "New Harness" }],
    });
    const { container } = render(() => <Sidebar />);

    await waitFor(() => {
      expect(container.querySelector(".sidebar__agents-empty")).not.toBeNull();
    });

    refreshAgents();

    await waitFor(() => {
      expect(container.querySelector('a[href="/harnesses/new-harness"]')).not.toBeNull();
    });
    expect(mockGetAgents).toHaveBeenCalledTimes(2);
  });

  it("renders the empty state only once the resource resolves empty (not while loading)", async () => {
    // Hold the resource in its loading state with a promise we resolve manually.
    let resolveAgents!: (v: unknown) => void;
    mockGetAgents.mockReturnValue(
      new Promise((res) => {
        resolveAgents = res;
      }),
    );
    const { container } = render(() => <Sidebar />);
    // The section is expanded, but while loading the empty state must NOT flash.
    expect(container.querySelector(".sidebar__agents-list")).not.toBeNull();
    expect(container.querySelector(".sidebar__agents-empty")).toBeNull();

    // Resolve to an empty list → empty state appears now that loading is done.
    resolveAgents({ agents: [] });
    await waitFor(() => {
      expect(container.querySelector(".sidebar__agents-empty")).not.toBeNull();
    });
    expect(container.querySelector(".sidebar__agents-empty")?.textContent).toContain(
      "No harnesses yet",
    );
    expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(0);
  });

  it("falls back to an empty list (and empty state) when getAgents rejects", async () => {
    mockGetAgents.mockRejectedValue(new Error("boom"));
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector(".sidebar__agents-empty")).not.toBeNull();
    });
  });

  it("falls back to an empty list when getAgents resolves to null", async () => {
    mockGetAgents.mockResolvedValue(null);
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector(".sidebar__agents-empty")).not.toBeNull();
    });
    expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(0);
  });
});

describe("Sidebar — collapse toggle", () => {
  it("the collapse toggle is a real button labelled HARNESSES with aria-expanded", async () => {
    const { container } = render(() => <Sidebar />);
    const caret = container.querySelector(".sidebar__section-caret");
    // Keyboard-operable: it is a <button> (native keyboard semantics), not a div.
    expect(caret?.tagName).toBe("BUTTON");
    expect((caret as HTMLButtonElement).type).toBe("button");
    expect(caret?.textContent).toContain("HARNESSES");
    expect(caret?.getAttribute("aria-expanded")).toBe("true");
  });

  it("hides the harness list when the toggle is clicked, and re-shows on toggle back", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector(".sidebar__agents-list")).not.toBeNull();
    });

    const caret = container.querySelector(".sidebar__section-caret") as HTMLButtonElement;
    expect(caret.getAttribute("aria-expanded")).toBe("true");

    await fireEvent.click(caret);
    expect(container.querySelector(".sidebar__agents-list")).toBeNull();
    expect(caret.getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(caret);
    expect(container.querySelector(".sidebar__agents-list")).not.toBeNull();
    expect(caret.getAttribute("aria-expanded")).toBe("true");
  });

  it("the section toggle and the + create button are sibling buttons (not nested)", () => {
    const { container } = render(() => <Sidebar />);
    const caret = container.querySelector(".sidebar__section-caret");
    const add = container.querySelector(".sidebar__section-add");
    expect(caret?.tagName).toBe("BUTTON");
    expect(add?.tagName).toBe("BUTTON");
    // A button must never contain another button.
    expect(caret?.querySelector("button")).toBeNull();
    expect(add?.querySelector("button")).toBeNull();
    // They share the same parent — true siblings.
    expect(add?.parentElement).toBe(caret?.parentElement);
    // No interactive <div> remains for the section header.
    expect(container.querySelector("div.sidebar__section-label--interactive")).toBeNull();
  });
});

describe("Sidebar — create-harness modal", () => {
  it("the + create button is always in the DOM and focusable (not hover-gated)", () => {
    const { container } = render(() => <Sidebar />);
    const addBtn = container.querySelector(".sidebar__section-add") as HTMLButtonElement;
    // Always rendered (not conditionally mounted on hover) and a real button,
    // so it is reachable by keyboard focus and touch.
    expect(addBtn).not.toBeNull();
    expect(addBtn.tagName).toBe("BUTTON");
    expect(addBtn.type).toBe("button");
    expect(addBtn.getAttribute("aria-label")).toBe("Create new harness");
    // It is focusable: focusing it makes it the active element.
    addBtn.focus();
    expect(document.activeElement).toBe(addBtn);
  });

  it("opens the AddAgentModal when the + button is clicked", async () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('[data-testid="add-agent-modal"]')).toBeNull();

    const addBtn = container.querySelector(".sidebar__section-add") as HTMLButtonElement;
    await fireEvent.click(addBtn);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="add-agent-modal"]')).not.toBeNull();
    });
    expect(mockAddModal).toHaveBeenCalledWith(true);
  });

  it("clicking + does not also toggle the section collapse", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelector(".sidebar__agents-list")).not.toBeNull();
    });
    const addBtn = container.querySelector(".sidebar__section-add") as HTMLButtonElement;
    await fireEvent.click(addBtn);
    // List stays visible — the + click stopped propagation to the label toggle.
    expect(container.querySelector(".sidebar__agents-list")).not.toBeNull();
  });
});

describe("Sidebar — structure and interaction", () => {
  it("has nav element with aria-label", () => {
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

  it("calls onNavigate when a harness item is clicked", async () => {
    const onNavigate = vi.fn();
    const { container } = render(() => <Sidebar onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(container.querySelector('a[href="/harnesses/alpha"]')).not.toBeNull();
    });
    const item = container.querySelector('a[href="/harnesses/alpha"]') as HTMLAnchorElement;
    item.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await fireEvent.click(item);
    expect(onNavigate).toHaveBeenCalled();
  });

  it("does not render the old Feedback section", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector("a.sidebar__feedback")).toBeNull();
  });
});

describe("Sidebar — Auto-fix card", () => {
  it("renders the Auto-fix discovery card with title, description, and external link", () => {
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector(".sidebar-autofix")).not.toBeNull();
    expect(container.querySelector(".sidebar-autofix__new-badge")).toBeNull();
    expect(container.querySelector(".sidebar-autofix__title")?.textContent).toBe("Discover Auto-fix");
    expect(container.textContent).toContain("Failing requests are automatically fixed");
    const link = container.querySelector(".sidebar-autofix__btn") as HTMLAnchorElement;
    expect(link?.textContent).toBe("Learn more");
    expect(link?.getAttribute("href")).toBe("https://manifest.build/autofix/");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("Sidebar — usage card", () => {
  it("renders free-plan usage and the near-limit warning state", async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: "free",
      requests: { used: 8_500, limit: 10_000, periodEnd: null },
    });

    const { container } = render(() => <Sidebar />);

    await screen.findByText(/8,500/);
    expect(container.querySelector(".sidebar-usage__count--danger")).not.toBeNull();
    expect(container.querySelector(".sidebar-usage__fill--danger")).not.toBeNull();
    expect(container.textContent).toContain(
      "You're limited to 10,000 requests this month. Upgrade for unlimited.",
    );
    expect(container.querySelector('a[href="/upgrade"]')).not.toBeNull();
  });

  it("renders the reached-limit warning state", async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: "free",
      requests: { used: 10_001, limit: 10_000, periodEnd: null },
    });

    const { container } = render(() => <Sidebar />);

    await screen.findByText(/10,001/);
    expect(container.textContent).toContain(
      "You've reached your monthly limit. Requests are being blocked.",
    );
    expect(container.querySelector(".sidebar-usage__fill--danger")).not.toBeNull();
  });

  it("renders the warning fill before the danger threshold", async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: "free",
      requests: { used: 5_500, limit: 10_000, periodEnd: null },
    });

    const { container } = render(() => <Sidebar />);

    await screen.findByText(/5,500/);
    expect(container.querySelector(".sidebar-usage__fill--warning")).not.toBeNull();
    expect(container.querySelector(".sidebar-usage__fill--danger")).toBeNull();
  });
});
