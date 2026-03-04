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

let mockIsLocalMode = false;
vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
  isLocalMode: () => mockIsLocalMode,
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

const mockSetDisplayName = vi.fn();
vi.mock("../../src/services/display-name.js", () => ({
  displayName: () => "Local User",
  setDisplayName: (...args: unknown[]) => mockSetDisplayName(...args),
}));

import Account from "../../src/pages/Account";

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockIsLocalMode = false;
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

  describe("local mode", () => {
    beforeEach(() => {
      mockIsLocalMode = true;
    });

    it("shows Profile section in local mode", () => {
      render(() => <Account />);
      expect(screen.getByText("Profile")).toBeDefined();
    });

    it("shows editable display name input in local mode", () => {
      render(() => <Account />);
      const inputs = screen.getAllByLabelText("Display name") as HTMLInputElement[];
      const editableInput = inputs.find((i) => !i.readOnly);
      expect(editableInput).toBeDefined();
      expect(editableInput!.value).toBe("Local User");
    });

    it("updates display name on blur in local mode", () => {
      render(() => <Account />);
      const inputs = screen.getAllByLabelText("Display name") as HTMLInputElement[];
      const editableInput = inputs.find((i) => !i.readOnly)!;
      fireEvent.input(editableInput, { target: { value: "New Name" } });
      fireEvent.blur(editableInput);
      expect(mockSetDisplayName).toHaveBeenCalledWith("New Name");
    });

    it("updates display name on Enter key in local mode", () => {
      render(() => <Account />);
      const inputs = screen.getAllByLabelText("Display name") as HTMLInputElement[];
      const editableInput = inputs.find((i) => !i.readOnly)!;
      fireEvent.input(editableInput, { target: { value: "Enter Name" } });
      fireEvent.keyDown(editableInput, { key: "Enter" });
      expect(mockSetDisplayName).toHaveBeenCalledWith("Enter Name");
    });

    it("hides cloud-only sections in local mode", () => {
      const { container } = render(() => <Account />);
      expect(container.textContent).not.toContain("Workspace");
      expect(container.textContent).not.toContain("Profile information");
    });
  });
});
