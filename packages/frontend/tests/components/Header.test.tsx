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

let mockIsLocalMode: boolean | null = false;
vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
  isLocalMode: () => mockIsLocalMode,
}));

import Header from "../../src/components/Header";

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  mockAgentName = null;
  mockIsLocalMode = false;
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
});

describe("Header - local mode", () => {
  it("logo links to /agents/local-agent in local mode", () => {
    mockIsLocalMode = true;
    const { container } = render(() => <Header />);
    const logoLink = container.querySelector(".header__logo") as HTMLAnchorElement;
    expect(logoLink.getAttribute("href")).toBe("/agents/local-agent");
  });

  it("logo links to / in cloud mode", () => {
    mockIsLocalMode = false;
    const { container } = render(() => <Header />);
    const logoLink = container.querySelector(".header__logo") as HTMLAnchorElement;
    expect(logoLink.getAttribute("href")).toBe("/");
  });

  it("hides Cloud badge in local mode", () => {
    mockIsLocalMode = true;
    render(() => <Header />);
    expect(screen.queryByText("Cloud")).toBeNull();
  });

  it("shows Cloud badge in cloud mode", () => {
    mockIsLocalMode = false;
    render(() => <Header />);
    expect(screen.getByText("Cloud")).toBeDefined();
  });

  it("hides Workspace breadcrumb in local mode", () => {
    mockIsLocalMode = true;
    mockAgentName = "my-agent";
    render(() => <Header />);
    expect(screen.queryByText("Workspace")).toBeNull();
  });

  it("shows Workspace breadcrumb in cloud mode", () => {
    mockIsLocalMode = false;
    mockAgentName = "my-agent";
    render(() => <Header />);
    expect(screen.getByText("Workspace")).toBeDefined();
  });

  it("hides Log out in local mode", async () => {
    mockIsLocalMode = true;
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.queryByText("Log out")).toBeNull();
  });

  it("shows Account Preferences in local mode", async () => {
    mockIsLocalMode = true;
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Account Preferences")).toBeDefined();
  });
});
