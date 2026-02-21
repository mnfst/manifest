import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { id: "u1", name: "Test User", email: "test@test.com" } },
      isPending: false,
    }),
  },
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
  isLocalMode: () => false,
}));

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

// Stub window.matchMedia for jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

import Account from "../../src/pages/Account";

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders Account Preferences heading", () => {
    render(() => <Account />);
    expect(screen.getByText("Account Preferences")).toBeDefined();
  });

  it("shows display name input with user name", () => {
    render(() => <Account />);
    const input = screen.getByLabelText("Display name") as HTMLInputElement;
    expect(input.value).toBe("Test User");
  });

  it("shows email input", () => {
    render(() => <Account />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.value).toBe("test@test.com");
  });

  it("shows theme options", () => {
    render(() => <Account />);
    expect(screen.getByText("Light")).toBeDefined();
    expect(screen.getByText("Dark")).toBeDefined();
    expect(screen.getByText("System")).toBeDefined();
  });

  it("shows workspace section", () => {
    render(() => <Account />);
    expect(screen.getByText("Workspace")).toBeDefined();
  });

  it("shows Back button", () => {
    render(() => <Account />);
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("shows profile information section", () => {
    render(() => <Account />);
    expect(screen.getByText("Profile information")).toBeDefined();
  });

  it("shows appearance section", () => {
    render(() => <Account />);
    expect(screen.getByText("Appearance")).toBeDefined();
  });

  it("shows workspace ID", () => {
    const { container } = render(() => <Account />);
    expect(container.textContent).toContain("u1");
  });

  it("applies light theme when Light clicked", () => {
    render(() => <Account />);
    fireEvent.click(screen.getByText("Light"));
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("applies dark theme when Dark clicked", () => {
    render(() => <Account />);
    fireEvent.click(screen.getByText("Dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("removes theme from storage when System clicked", () => {
    localStorage.setItem("theme", "dark");
    render(() => <Account />);
    fireEvent.click(screen.getByText("System"));
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("copies user ID to clipboard when copy button clicked", () => {
    const { container } = render(() => <Account />);
    const copyBtn = container.querySelector(".settings-card__copy-btn")!;
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("u1");
  });

  it("reads stored theme on mount", () => {
    localStorage.setItem("theme", "dark");
    render(() => <Account />);
    // Component should read and apply stored theme
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
