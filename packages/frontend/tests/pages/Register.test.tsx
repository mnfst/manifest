import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    signUp: { email: vi.fn().mockResolvedValue({}) },
    sendVerificationEmail: vi.fn().mockResolvedValue({}),
  },
}));

import Register from "../../src/pages/Register";

describe("Register", () => {
  it("renders create account heading", () => {
    render(() => <Register />);
    expect(screen.getByText("Create an account")).toBeDefined();
  });

  it("renders name, email, and password inputs", () => {
    render(() => <Register />);
    expect(screen.getByPlaceholderText("Your name")).toBeDefined();
    expect(screen.getByPlaceholderText("you@example.com")).toBeDefined();
    expect(screen.getByPlaceholderText("Create a password")).toBeDefined();
  });

  it("renders create account button", () => {
    render(() => <Register />);
    expect(screen.getByText("Create account")).toBeDefined();
  });

  it("has link to sign in", () => {
    render(() => <Register />);
    expect(screen.getByText("Sign in")).toBeDefined();
  });

  it("shows terms and privacy links", () => {
    render(() => <Register />);
    expect(screen.getByText("Terms")).toBeDefined();
    expect(screen.getByText("Privacy Policy")).toBeDefined();
  });
});
