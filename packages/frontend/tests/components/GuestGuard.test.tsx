import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

const mockNavigate = vi.fn();
let mockSessionData: any = { data: null, isPending: false };

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => mockSessionData,
  },
}));

import GuestGuard from "../../src/components/GuestGuard";

describe("GuestGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = { data: null, isPending: false };
  });

  it("renders children when no session", () => {
    render(() => (
      <GuestGuard>
        <span>Guest content</span>
      </GuestGuard>
    ));
    expect(screen.getByText("Guest content")).toBeDefined();
  });

  it("redirects to home when session exists", async () => {
    mockSessionData = {
      data: { user: { id: "u1", name: "Test" } },
      isPending: false,
    };
    render(() => (
      <GuestGuard>
        <span>Guest content</span>
      </GuestGuard>
    ));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});
