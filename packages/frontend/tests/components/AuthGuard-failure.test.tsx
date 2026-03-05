import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";

/**
 * Separate test file for AuthGuard failure paths.
 *
 * AuthGuard has a module-level signal (autoLoginState) that starts "idle"
 * and transitions permanently. This file tests the FAILURE path where
 * tryLocalAutoLogin returns false, which sets autoLoginState to "failed"
 * and navigates to /login.
 */

const mockNavigate = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => mockSessionData,
  },
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(true),
}));

let mockSessionData: any = { data: null, isPending: false };

import AuthGuard from "../../src/components/AuthGuard";

describe("AuthGuard failure path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = { data: null, isPending: false, refetch: async () => {} };
  });

  it("navigates to login when local auto-login fetch throws", async () => {
    // fetch throws -> catch { return false } -> setAutoLoginState("failed")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

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
