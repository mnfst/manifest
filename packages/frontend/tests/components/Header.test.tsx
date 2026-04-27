import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockNavigate = vi.fn();

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { id: "u1", name: "Alice", email: "alice@test.com" } },
      isPending: false,
    }),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));

let mockAgentName: string | null = null;
vi.mock("../../src/services/routing.js", () => ({
  useAgentName: () => () => mockAgentName,
}));

vi.mock("../../src/services/api.js", () => ({
  duplicateAgent: vi.fn(),
  getDuplicatePreview: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/services/recent-agents.js", () => ({
  markAgentCreated: vi.fn(),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

let mockAgentDisplayName: string | null = null;
vi.mock("../../src/services/agent-display-name.js", () => ({
  agentDisplayName: () => mockAgentDisplayName,
}));

const mockCheckIsSelfHosted = vi.fn().mockResolvedValue(false);
vi.mock("../../src/services/setup-status.js", () => ({
  checkIsSelfHosted: () => mockCheckIsSelfHosted(),
}));

import Header from "../../src/components/Header";

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  mockAgentName = null;
  mockAgentDisplayName = null;
  mockCheckIsSelfHosted.mockReset();
  mockCheckIsSelfHosted.mockResolvedValue(false);
});

describe("Header", () => {
  it("renders logo", () => {
    const { container } = render(() => <Header />);
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(2);
  });

  it("shows user initials", () => {
    render(() => <Header />);
    expect(screen.getByText("A")).toBeDefined();
  });

  it("shows user menu button", () => {
    render(() => <Header />);
    expect(screen.getByLabelText("User menu")).toBeDefined();
  });

  it("opens dropdown on click", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("alice@test.com")).toBeDefined();
  });

  it("shows Account Preferences link in dropdown", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Account Preferences")).toBeDefined();
  });

  it("shows Log out button in dropdown", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Log out")).toBeDefined();
  });

  it("calls signOut when Log out clicked", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    await fireEvent.click(screen.getByText("Log out"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("navigates to login after signOut", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    await fireEvent.click(screen.getByText("Log out"));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("closes dropdown when clicking outside", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Alice")).toBeDefined();
    await fireEvent.click(document.body);
    expect(screen.queryByText("Alice")).toBeNull();
  });
});

describe("Header - GitHub star button", () => {
  it("renders the star button with link to GitHub repo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 1234 }))
    );
    const { container } = render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("Star")).toBeDefined();
    });
    const link = container.querySelector(".header__github-star-btn") as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.href).toContain("github.com/mnfst/manifest");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it("fetches and displays the star count", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 5678 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("5,678")).toBeDefined();
    });
  });

  it("formats large star counts with locale separators", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 12345 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("12,345")).toBeDefined();
    });
  });

  it("renders star button without count when API returns non-numeric value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: "not a number" }))
    );
    const { container } = render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("Star")).toBeDefined();
    });
    expect(container.querySelector(".header__github-star-count")).toBeNull();
  });

  it("renders star button without count when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const { container } = render(() => <Header />);
    // Star label should still appear
    await vi.waitFor(() => {
      expect(screen.getByText("Star")).toBeDefined();
    });
    expect(container.querySelector(".header__github-star-count")).toBeNull();
  });

  it("shows dismiss button", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 100 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Dismiss GitHub star button")).toBeDefined();
    });
  });

  it("hides star button when dismiss is clicked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 100 }))
    );
    const { container } = render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("Star")).toBeDefined();
    });
    await fireEvent.click(screen.getByLabelText("Dismiss GitHub star button"));
    expect(container.querySelector(".header__github-star")).toBeNull();
  });

  it("persists dismiss state in sessionStorage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 100 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("Star")).toBeDefined();
    });
    await fireEvent.click(screen.getByLabelText("Dismiss GitHub star button"));
    expect(sessionStorage.getItem("github-star-dismissed")).toBe("true");
  });

  it("does not render star button if previously dismissed", async () => {
    sessionStorage.setItem("github-star-dismissed", "true");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 100 }))
    );
    const { container } = render(() => <Header />);
    expect(container.querySelector(".header__github-star")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not fetch star count if dismissed", () => {
    sessionStorage.setItem("github-star-dismissed", "true");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 100 }))
    );
    render(() => <Header />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses cached star count from sessionStorage", async () => {
    sessionStorage.setItem("github-star-count", "9999");
    sessionStorage.setItem("github-star-ts", String(Date.now()));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("9,999")).toBeDefined();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches fresh count when cache is expired", async () => {
    sessionStorage.setItem("github-star-count", "9999");
    sessionStorage.setItem("github-star-ts", String(Date.now() - 4000000));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 5555 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("5,555")).toBeDefined();
    });
  });

  it("caches star count in sessionStorage after fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stars: 4321 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("4,321")).toBeDefined();
    });
    expect(sessionStorage.getItem("github-star-count")).toBe("4321");
    expect(sessionStorage.getItem("github-star-ts")).toBeDefined();
  });
});

describe("Header - breadcrumb", () => {
  it("logo links to /", () => {
    const { container } = render(() => <Header />);
    const logoLink = container.querySelector(".header__logo") as HTMLAnchorElement;
    expect(logoLink.getAttribute("href")).toBe("/");
  });

  it("shows Workspace breadcrumb when agent is active", () => {
    mockAgentName = "my-agent";
    render(() => <Header />);
    expect(screen.getByText("Workspace")).toBeDefined();
  });
});

describe("Header - gear dropdown", () => {
  it("shows gear button when on an agent page", () => {
    mockAgentName = "my-agent";
    render(() => <Header />);
    expect(screen.getByLabelText("Agent actions")).toBeDefined();
  });

  it("does not show gear button when not on an agent page", () => {
    mockAgentName = null;
    render(() => <Header />);
    expect(screen.queryByLabelText("Agent actions")).toBeNull();
  });

  it("opens dropdown with Settings and Duplicate items", async () => {
    mockAgentName = "my-agent";
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("Agent actions"));
    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("Duplicate agent")).toBeDefined();
  });

  it("Settings links to the agent settings page", async () => {
    mockAgentName = "my-agent";
    const { container } = render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("Agent actions"));
    const settingsLink = container.querySelector('a[href="/agents/my-agent/settings"]');
    expect(settingsLink).not.toBeNull();
  });

  it("closes gear dropdown when clicking outside", async () => {
    mockAgentName = "my-agent";
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("Agent actions"));
    expect(screen.getByText("Settings")).toBeDefined();
    await fireEvent.click(document.body);
    expect(screen.queryByText("Duplicate agent")).toBeNull();
  });
});

describe("Header - self-hosted badge", () => {
  it("renders the Self-hosted badge when isSelfHosted is true", async () => {
    mockCheckIsSelfHosted.mockResolvedValue(true);
    const { container } = render(() => <Header />);
    await new Promise((r) => setTimeout(r, 0));
    const badge = container.querySelector(".header__mode-badge");
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe("Self-hosted");
  });

  it("does not render the badge in cloud mode", async () => {
    mockCheckIsSelfHosted.mockResolvedValue(false);
    const { container } = render(() => <Header />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector(".header__mode-badge")).toBeNull();
  });
});
