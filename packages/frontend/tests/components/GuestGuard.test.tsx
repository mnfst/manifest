import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

const mockNavigate = vi.fn();
const mockCheckNeedsSetup = vi.fn();
let mockSessionData: any = { data: null, isPending: false };
let setMockSession: ((v: any) => void) | undefined;

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => mockSessionData,
  },
}));

vi.mock("../../src/services/setup-status.js", () => ({
  checkNeedsSetup: (...args: unknown[]) => mockCheckNeedsSetup(...args),
}));

import GuestGuard from "../../src/components/GuestGuard";

describe("GuestGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = { data: null, isPending: false };
    mockCheckNeedsSetup.mockResolvedValue(false);
  });

  it("renders children when no session and setup is complete", async () => {
    render(() => (
      <GuestGuard>
        <span>Guest content</span>
      </GuestGuard>
    ));
    await vi.waitFor(() => {
      expect(screen.getByText("Guest content")).not.toBeNull();
    });
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

  it("redirects to /setup when setup is incomplete", async () => {
    mockCheckNeedsSetup.mockResolvedValue(true);
    render(() => (
      <GuestGuard>
        <span>Guest content</span>
      </GuestGuard>
    ));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/setup", { replace: true });
    });
  });

  it("does not render children while setup check is pending", () => {
    // checkNeedsSetup hangs — we should see no content rendered yet
    mockCheckNeedsSetup.mockReturnValue(new Promise(() => undefined));
    const { container } = render(() => (
      <GuestGuard>
        <span>Guest content</span>
      </GuestGuard>
    ));
    expect(container.textContent).not.toContain("Guest content");
  });

  it("keeps children mounted when session briefly goes pending after initial render", async () => {
    // Use a reactive signal so we can change session state mid-test
    const [sessionSig, setSession] = createSignal<any>({
      data: null,
      isPending: false,
    });
    setMockSession = setSession;

    // Override the mock to use reactive signal for this test
    const origMock = vi.mocked(
      await import("../../src/services/auth-client.js")
    );
    origMock.authClient.useSession = () => sessionSig;

    render(() => (
      <GuestGuard>
        <span>Guest content</span>
      </GuestGuard>
    ));

    // Wait for children to appear (setup check resolves, session not pending)
    await vi.waitFor(() => {
      expect(screen.getByText("Guest content")).not.toBeNull();
    });

    // Simulate Better Auth triggering a session refetch (isPending goes true)
    setSession({ data: null, isPending: true });
    // Children should still be mounted
    expect(screen.getByText("Guest content")).not.toBeNull();

    // Session refetch completes with no data
    setSession({ data: null, isPending: false });
    // Children should still be mounted
    expect(screen.getByText("Guest content")).not.toBeNull();
  });
});
