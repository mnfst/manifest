import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

const mockNavigate = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { id: "u1", name: "Test" } },
      isPending: false,
    }),
  },
}));

import AuthGuard from "../../src/components/AuthGuard";

describe("AuthGuard", () => {
  it("renders children when session exists", () => {
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(screen.getByText("Protected content")).toBeDefined();
  });
});
