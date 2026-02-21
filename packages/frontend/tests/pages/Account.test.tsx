import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

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

import Account from "../../src/pages/Account";

describe("Account", () => {
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
});
