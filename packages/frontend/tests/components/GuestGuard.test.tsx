import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: null,
      isPending: false,
    }),
  },
}));

import GuestGuard from "../../src/components/GuestGuard";

describe("GuestGuard", () => {
  it("renders children when no session", () => {
    render(() => (
      <GuestGuard>
        <span>Guest content</span>
      </GuestGuard>
    ));
    expect(screen.getByText("Guest content")).toBeDefined();
  });
});
