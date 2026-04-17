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

import AuthGuard from "../../src/components/AuthGuard";

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = {
      data: { user: { id: "u1", name: "Test" } },
      isPending: false,
    };
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

  it("shows loading state when no session data", () => {
    mockSessionData = { data: null, isPending: false };
    const { container } = render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(container.textContent).toContain("Loading...");
  });

  it("navigates to login when no session", async () => {
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
