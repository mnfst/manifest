import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useNavigate: () => vi.fn(),
  useSearchParams: () => [{}],
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    signIn: { email: vi.fn().mockResolvedValue({}), social: vi.fn() },
    sendVerificationEmail: vi.fn().mockResolvedValue({}),
  },
}));

import Login from "../../src/pages/Login";

describe("Login", () => {
  it("renders welcome message", () => {
    render(() => <Login />);
    expect(screen.getByText("Welcome back")).toBeDefined();
  });

  it("renders email and password inputs", () => {
    render(() => <Login />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeDefined();
    expect(screen.getByPlaceholderText("Enter your password")).toBeDefined();
  });

  it("renders sign in button", () => {
    render(() => <Login />);
    expect(screen.getByText("Sign in")).toBeDefined();
  });

  it("has link to register", () => {
    render(() => <Login />);
    expect(screen.getByText("Sign up")).toBeDefined();
  });

  it("has forgot password link", () => {
    render(() => <Login />);
    expect(screen.getByText("Forgot password?")).toBeDefined();
  });
});
