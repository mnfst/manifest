import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// Workspace Autofix status drives the bottom-left card and the modal list.
const mockGetAutofixStatus = vi.fn();
vi.mock("../../src/services/api/analytics.js", () => ({
  getWorkspaceAutofixStatus: (...args: unknown[]) => mockGetAutofixStatus(...args),
}));

// Per-agent Autofix saves fired by the modal toggles.
const mockUpdateAutofix = vi.fn();
vi.mock("../../src/services/api/routing.js", () => ({
  updateAutofix: (...args: unknown[]) => mockUpdateAutofix(...args),
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
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: false,
      enabled_agents: [],
      disabled_agents: ["alpha", "beta"],
      needs_enable_all: true,
      consented: false,
    });
  sessionStorage.clear();
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

  it("applies the platform-icon theming class to the platform icon", async () => {
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2);
    });
    const alpha = container.querySelector('a[href="/harnesses/alpha"]');
    const icon = alpha?.querySelector("img.sidebar__agent-icon");
    expect(icon?.classList.contains("platform-icon")).toBe(true);
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

describe("Sidebar — Autofix card", () => {
  it("shows the card with the Enable button while some agents lack Autofix", async () => {
    const { container } = render(() => <Sidebar />);
    await screen.findByText("Keep your agents reliable");
    expect(container.querySelector(".sidebar-autofix")).not.toBeNull();
    expect(container.textContent).toContain("Enable it to repair eligible failing requests");
    const btn = container.querySelector("button.sidebar-autofix__btn") as HTMLButtonElement;
    expect(btn?.textContent).toBe("Enable");
  });

  it("shows the card in cloud too", async () => {
    mockIsSelfHosted = false;
    const { container } = render(() => <Sidebar />);
    await screen.findByText("Keep your agents reliable");
    expect(container.querySelector("button.sidebar-autofix__btn")).not.toBeNull();
  });

  it("hides the card when the status fetch fails (fail-soft fallback)", async () => {
    mockGetAutofixStatus.mockRejectedValue(new Error("boom"));
    const { container } = render(() => <Sidebar />);
    await waitFor(() => expect(container.querySelector(".sidebar__agents-list")).not.toBeNull());
    expect(container.querySelector(".sidebar-autofix")).toBeNull();
  });

  it("hides the card entirely once every agent has Autofix", async () => {
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: true,
      enabled_agents: ["alpha", "beta"],
      disabled_agents: [],
      needs_enable_all: false,
      consented: true,
    });
    const { container } = render(() => <Sidebar />);
    // Wait for the status resource to settle on an unrelated async element.
    await waitFor(() => expect(container.querySelector(".sidebar__agents-list")).not.toBeNull());
    expect(container.querySelector(".sidebar-autofix")).toBeNull();
  });

  it("keeps the card with coverage copy while only some agents are enabled", async () => {
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: true,
      enabled_agents: ["alpha"],
      disabled_agents: ["beta"],
      needs_enable_all: false,
      consented: true,
    });
    const { container } = render(() => <Sidebar />);
    await screen.findByText("Keep your agents reliable");
    expect(container.textContent).toContain("At least one of your agents runs without Autofix.");
    expect(container.querySelector("button.sidebar-autofix__btn")).not.toBeNull();
  });

  it("dismisses the card for the session via the close button", async () => {
    const { container, unmount } = render(() => <Sidebar />);
    await screen.findByText("Keep your agents reliable");

    fireEvent.click(container.querySelector("button.sidebar-autofix__dismiss")!);
    expect(container.querySelector(".sidebar-autofix")).toBeNull();
    expect(sessionStorage.getItem("autofix-card-dismissed")).toBe("1");
    unmount();

    // A remount within the same session stays dismissed.
    const second = render(() => <Sidebar />);
    await waitFor(() =>
      expect(second.container.querySelector(".sidebar__agents-list")).not.toBeNull(),
    );
    expect(second.container.querySelector(".sidebar-autofix")).toBeNull();
    second.unmount();

    // A fresh session (cleared sessionStorage) brings the card back.
    sessionStorage.clear();
    const third = render(() => <Sidebar />);
    await waitFor(() => expect(third.container.querySelector(".sidebar-autofix")).not.toBeNull());
  });

  it("closes the modal via Done, overlay, and Escape without saving anything", async () => {
    const { container } = render(() => <Sidebar />);
    await screen.findByText("Keep your agents reliable");
    const open = () => fireEvent.click(container.querySelector("button.sidebar-autofix__btn")!);

    open();
    await screen.findByText("Enable Autofix");
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByText("Enable Autofix")).toBeNull();

    open();
    await screen.findByText("Enable Autofix");
    const overlay = document.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(screen.queryByText("Enable Autofix")).toBeNull();

    open();
    await screen.findByText("Enable Autofix");
    fireEvent.keyDown(document.querySelector(".modal-overlay")!, { key: "Escape" });
    expect(screen.queryByText("Enable Autofix")).toBeNull();

    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it("always opens the modal from Enable, even when the install already consented", async () => {
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: false,
      enabled_agents: [],
      disabled_agents: ["alpha", "beta"],
      needs_enable_all: true,
      consented: true,
    });
    const { container } = render(() => <Sidebar />);
    await screen.findByText("Enable");
    fireEvent.click(container.querySelector("button.sidebar-autofix__btn")!);
    await screen.findByText("Enable Autofix");
    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it("polls the status so a toggle made elsewhere hides the card", async () => {
    // Autofix toggles emit no SSE event, so the card relies on the 15s poll
    // to notice a change made from the Settings page.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockGetAutofixStatus
        .mockResolvedValueOnce({
          any_enabled: false,
          enabled_agents: [],
          disabled_agents: ["alpha"],
          needs_enable_all: true,
          consented: false,
        })
        .mockResolvedValue({
          any_enabled: true,
          enabled_agents: ["alpha"],
          disabled_agents: [],
          needs_enable_all: false,
          consented: true,
        });
      const { container } = render(() => <Sidebar />);
      await screen.findByText("Keep your agents reliable");
      await vi.advanceTimersByTimeAsync(15_000);
      await waitFor(() => expect(container.querySelector(".sidebar-autofix")).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the last known status when a poll tick fails", async () => {
    // A network blip on a refetch must not blank a known-good status: the
    // card would flicker off for a tick. Only the first load falls back empty.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockGetAutofixStatus
        .mockResolvedValueOnce({
          any_enabled: false,
          enabled_agents: [],
          disabled_agents: ["alpha"],
          needs_enable_all: true,
          consented: false,
        })
        .mockRejectedValue(new Error("blip"));
      const { container } = render(() => <Sidebar />);
      await screen.findByText("Keep your agents reliable");
      await vi.advanceTimersByTimeAsync(15_000);
      await waitFor(() => expect(mockGetAutofixStatus.mock.calls.length).toBeGreaterThan(1));
      expect(container.querySelector(".sidebar-autofix")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Sidebar — Autofix per-agent modal", () => {
  const openModal = async (container: HTMLElement) => {
    await screen.findByText("Keep your agents reliable");
    fireEvent.click(container.querySelector("button.sidebar-autofix__btn")!);
    await screen.findByText("Enable Autofix");
  };
  const switches = () =>
    Array.from(document.querySelectorAll(".autofix-consent__agent-row .settings-switch"));

  it("lists one row per uncovered agent with its icon, name, and an off switch", async () => {
    const { container } = render(() => <Sidebar />);
    // Wait for the harness list so the snapshot can resolve display names.
    await waitFor(() =>
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2),
    );
    await openModal(container);

    const rows = document.querySelectorAll(".autofix-consent__agent-row");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Alpha Harness");
    expect(rows[0].querySelector("img.autofix-consent__agent-icon")).not.toBeNull();
    expect(rows[1].textContent).toContain("beta");
    expect(rows[1].querySelector("img.autofix-consent__agent-icon")).toBeNull();
    for (const sw of switches()) {
      expect(sw.getAttribute("aria-checked")).toBe("false");
    }
    expect(document.body.textContent).toContain("Autofix works per agent");
    expect(document.body.textContent).toContain("you agree to Manifest's");
  });

  it("saves a toggle immediately and flips the switch on", async () => {
    mockUpdateAutofix.mockResolvedValue({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await waitFor(() =>
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2),
    );
    await openModal(container);

    fireEvent.click(switches()[0]);
    expect(mockUpdateAutofix).toHaveBeenCalledWith("alpha", { enabled: true });
    await waitFor(() => expect(switches()[0].getAttribute("aria-checked")).toBe("true"));
  });

  it("lets other toggles fire while a save is still in flight", async () => {
    let resolveFirst!: (v: unknown) => void;
    mockUpdateAutofix
      .mockReturnValueOnce(new Promise((res) => (resolveFirst = res)))
      .mockResolvedValueOnce({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await waitFor(() =>
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2),
    );
    await openModal(container);

    fireEvent.click(switches()[0]);
    fireEvent.click(switches()[1]);
    // Both saves fired without waiting for each other, both rows optimistic on.
    expect(mockUpdateAutofix).toHaveBeenCalledTimes(2);
    expect(mockUpdateAutofix).toHaveBeenNthCalledWith(1, "alpha", { enabled: true });
    expect(mockUpdateAutofix).toHaveBeenNthCalledWith(2, "beta", { enabled: true });
    expect(switches()[0].getAttribute("aria-checked")).toBe("true");
    expect(switches()[1].getAttribute("aria-checked")).toBe("true");
    resolveFirst({ enabled: true, consented: true });
  });

  it("ignores repeat clicks on a row while its own save is in flight", async () => {
    // The switch stays focusable during a save (aria-disabled, not disabled,
    // so the modal's focus trap keeps working) — the re-entry guard is JS.
    let resolveFirst!: (v: unknown) => void;
    mockUpdateAutofix.mockReturnValueOnce(new Promise((res) => (resolveFirst = res)));
    const { container } = render(() => <Sidebar />);
    await waitFor(() =>
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2),
    );
    await openModal(container);

    fireEvent.click(switches()[0]);
    expect(switches()[0].getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(switches()[0]);
    expect(mockUpdateAutofix).toHaveBeenCalledTimes(1);
    resolveFirst({ enabled: true, consented: true });
    await waitFor(() => expect(switches()[0].getAttribute("aria-disabled")).toBe("false"));
  });

  it("reverts a row when its save fails", async () => {
    mockUpdateAutofix.mockRejectedValue(new Error("boom"));
    const { container } = render(() => <Sidebar />);
    await waitFor(() =>
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2),
    );
    await openModal(container);

    fireEvent.click(switches()[0]);
    expect(switches()[0].getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(switches()[0].getAttribute("aria-checked")).toBe("false"));
  });

  it("saves a toggle back off and keeps the row listed", async () => {
    mockUpdateAutofix.mockResolvedValue({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await waitFor(() =>
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2),
    );
    await openModal(container);

    fireEvent.click(switches()[0]);
    await waitFor(() => expect(switches()[0].getAttribute("aria-checked")).toBe("true"));

    mockUpdateAutofix.mockResolvedValue({ enabled: false, consented: true });
    fireEvent.click(switches()[0]);
    expect(mockUpdateAutofix).toHaveBeenLastCalledWith("alpha", { enabled: false });
    await waitFor(() => expect(switches()[0].getAttribute("aria-checked")).toBe("false"));
    expect(document.querySelectorAll(".autofix-consent__agent-row").length).toBe(2);
  });

  it("hides the sidebar card once every agent is covered, while the modal stays open", async () => {
    mockUpdateAutofix.mockResolvedValue({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await waitFor(() =>
      expect(container.querySelectorAll("a.sidebar__agent-item").length).toBe(2),
    );
    await openModal(container);

    fireEvent.click(switches()[0]);
    fireEvent.click(switches()[1]);
    await waitFor(() => expect(container.querySelector(".sidebar-autofix")).toBeNull());
    // The modal itself stays open until Done.
    expect(screen.queryByText("Enable Autofix")).not.toBeNull();
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByText("Enable Autofix")).toBeNull();
  });

  it("falls back to the raw agent name when the harness list has not resolved", async () => {
    // Status resolves with an agent the harness switcher does not know.
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: false,
      enabled_agents: [],
      disabled_agents: ["ghost"],
      needs_enable_all: true,
      consented: false,
    });
    mockGetAgents.mockResolvedValue({ agents: [] });
    const { container } = render(() => <Sidebar />);
    await openModal(container);
    const rows = document.querySelectorAll(".autofix-consent__agent-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("ghost");
    expect(rows[0].querySelector("img.autofix-consent__agent-icon")).toBeNull();
  });
});

describe("Sidebar — usage card", () => {
  beforeEach(() => {
    // The usage meter only occupies the bottom-left slot in cloud; self-hosted
    // always shows the Autofix card there.
    mockIsSelfHosted = false;
  });
  afterEach(() => {
    mockIsSelfHosted = true;
  });

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

  it("hides the usage card when the billing fetch fails (fail-soft fallback)", async () => {
    mockGetBillingStatus.mockRejectedValue(new Error("boom"));
    const { container } = render(() => <Sidebar />);
    await waitFor(() => expect(container.querySelector(".sidebar__agents-list")).not.toBeNull());
    expect(container.querySelector(".sidebar-usage")).toBeNull();
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
