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

vi.mock("../../src/services/routing.js", () => ({
  useAgentName: () => () => null,
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
  isLocalMode: () => false,
}));

import Header from "../../src/components/Header";

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
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
      new Response(JSON.stringify({ stargazers_count: 1234 }))
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
      new Response(JSON.stringify({ stargazers_count: 5678 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("5,678")).toBeDefined();
    });
  });

  it("formats large star counts with locale separators", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stargazers_count: 12345 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByText("12,345")).toBeDefined();
    });
  });

  it("renders star button without count when API returns non-numeric value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stargazers_count: "not a number" }))
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
      new Response(JSON.stringify({ stargazers_count: 100 }))
    );
    render(() => <Header />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Dismiss GitHub star button")).toBeDefined();
    });
  });

  it("hides star button when dismiss is clicked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stargazers_count: 100 }))
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
      new Response(JSON.stringify({ stargazers_count: 100 }))
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
      new Response(JSON.stringify({ stargazers_count: 100 }))
    );
    const { container } = render(() => <Header />);
    expect(container.querySelector(".header__github-star")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not fetch star count if dismissed", () => {
    sessionStorage.setItem("github-star-dismissed", "true");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ stargazers_count: 100 }))
    );
    render(() => <Header />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
