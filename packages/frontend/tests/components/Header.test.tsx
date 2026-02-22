import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockNavigate = vi.fn();

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { id: "u1", name: "Alice", email: "alice@test.com" } },
      isPending: false,
    }),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));

vi.mock("../../src/services/routing.js", () => ({
  useAgentName: () => () => null,
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
  isLocalMode: () => false,
}));

import Header from "../../src/components/Header";

describe("Header", () => {
  it("renders logo", () => {
    const { container } = render(() => <Header />);
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(2);
  });

  it("shows user initials", () => {
    render(() => <Header />);
    expect(screen.getByText("A")).toBeDefined();
  });

  it("shows user menu button", () => {
    render(() => <Header />);
    expect(screen.getByLabelText("User menu")).toBeDefined();
  });

  it("opens dropdown on click", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("alice@test.com")).toBeDefined();
  });

  it("shows Account Preferences link in dropdown", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Account Preferences")).toBeDefined();
  });

  it("shows Log out button in dropdown", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Log out")).toBeDefined();
  });

  it("calls signOut when Log out clicked", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    await fireEvent.click(screen.getByText("Log out"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("navigates to login after signOut", async () => {
    render(() => <Header />);
    await fireEvent.click(screen.getByLabelText("User menu"));
    await fireEvent.click(screen.getByText("Log out"));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });
});
