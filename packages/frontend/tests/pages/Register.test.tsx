import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockSignUpEmail = vi.fn().mockResolvedValue({});
const mockSendVerificationEmail = vi.fn().mockResolvedValue({});

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => mockSignUpEmail(...args) },
    sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
  },
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import Register from "../../src/pages/Register";

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignUpEmail.mockResolvedValue({});
  });

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

  it("submits registration form", async () => {
    mockSignUpEmail.mockResolvedValue({ error: null });
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "test@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(mockSignUpEmail).toHaveBeenCalled();
    });
  });

  it("shows email verification after successful signup", async () => {
    mockSignUpEmail.mockResolvedValue({ error: null });
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "test@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Check your email");
    });
  });

  it("shows error on failed registration", async () => {
    mockSignUpEmail.mockResolvedValue({ error: { message: "Email already exists" } });
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "exists@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Email already exists");
    });
  });

  it("shows loading state during submission", async () => {
    mockSignUpEmail.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "t@t.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Creating account");
    });
  });

  it("shows resend button after successful signup", async () => {
    mockSignUpEmail.mockResolvedValue({ error: null });
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "test@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass12345" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Click the link in your email");
    });
    // Resend button should be present (with cooldown since startCooldown was called)
    const resendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Resend in"),
    );
    expect(resendBtn).not.toBeUndefined();
  });

  it("calls sendVerificationEmail on resend click after cooldown", async () => {
    vi.useFakeTimers();
    mockSignUpEmail.mockResolvedValue({ error: null });
    mockSendVerificationEmail.mockResolvedValue({ error: null });
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "test@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass12345" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Check your email");
    });
    // Fast-forward past cooldown
    vi.advanceTimersByTime(61000);
    const resendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Resend verification email"),
    );
    if (resendBtn) {
      fireEvent.click(resendBtn);
      await vi.waitFor(() => {
        expect(mockSendVerificationEmail).toHaveBeenCalledWith({ email: "test@test.com", callbackURL: "/" });
      });
    }
    vi.useRealTimers();
  });

  it("shows error when resend fails", async () => {
    vi.useFakeTimers();
    mockSignUpEmail.mockResolvedValue({ error: null });
    mockSendVerificationEmail.mockResolvedValue({ error: { message: "Too many requests" } });
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "test@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass12345" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Check your email");
    });
    vi.advanceTimersByTime(61000);
    const resendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Resend verification email"),
    );
    if (resendBtn) {
      fireEvent.click(resendBtn);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("Too many requests");
      });
    }
    vi.useRealTimers();
  });

  it("shows back to sign in link on verification screen", async () => {
    mockSignUpEmail.mockResolvedValue({ error: null });
    const { container } = render(() => <Register />);
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: "Test" } });
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "test@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass12345" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      const link = container.querySelector('a[href="/login"]');
      expect(link).not.toBeNull();
    });
  });
});
