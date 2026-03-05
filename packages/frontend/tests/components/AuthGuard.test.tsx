import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";

const mockNavigate = vi.fn();
let mockSessionData: any = {
  data: { user: { id: "u1", name: "Test" } },
  isPending: false,
};

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => mockSessionData,
  },
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
}));

import AuthGuard from "../../src/components/AuthGuard";

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = {
      data: { user: { id: "u1", name: "Test" } },
      isPending: false,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  it("renders children when session exists", () => {
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(screen.getByText("Protected content")).toBeDefined();
  });

  it("shows loading state when session is pending", () => {
    mockSessionData = { data: null, isPending: true };
    const { container } = render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(container.textContent).toContain("Loading...");
  });

  // AuthGuard has a module-level autoLoginState signal that starts "idle"
  // and transitions permanently. This test must run while state is still
  // "idle" (before any test sets data=null + isPending=false without pending state).
  it("triggers auto-login for local mode when state is idle", async () => {
    const { checkLocalMode } = await import("../../src/services/local-mode.js");
    (checkLocalMode as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    let sessionRefetched = false;
    mockSessionData = {
      data: null,
      isPending: false,
      refetch: async () => {
        sessionRefetched = true;
        mockSessionData = {
          data: { user: { id: "u1", name: "Local" } },
          isPending: false,
          refetch: async () => {},
        };
      },
    };

    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));

    await vi.waitFor(() => {
      expect(sessionRefetched).toBe(true);
    });
  });

  it("shows loading state when no session data", () => {
    mockSessionData = { data: null, isPending: false };
    const { container } = render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(container.textContent).toContain("Loading...");
  });

  it("navigates to login when no session and auto-login already done", async () => {
    mockSessionData = { data: null, isPending: false };
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });
});
