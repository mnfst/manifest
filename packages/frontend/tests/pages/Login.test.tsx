import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockSignInEmail = vi.fn().mockResolvedValue({});
const mockSendVerificationEmail = vi.fn().mockResolvedValue({});

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
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args), social: vi.fn() },
    sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
  },
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import Login from "../../src/pages/Login";

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInEmail.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

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

  it("shows or divider", () => {
    render(() => <Login />);
    expect(screen.getByText("or")).toBeDefined();
  });

  it("submits login form", async () => {
    mockSignInEmail.mockResolvedValue({ error: null });
    const { container } = render(() => <Login />);
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.input(emailInput, { target: { value: "test@test.com" } });
    fireEvent.input(passwordInput, { target: { value: "password123" } });
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    await vi.waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith({ email: "test@test.com", password: "password123" });
    });
  });

  it("shows error on failed login", async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: "Invalid credentials" } });
    const { container } = render(() => <Login />);
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.input(emailInput, { target: { value: "bad@test.com" } });
    fireEvent.input(passwordInput, { target: { value: "wrong" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Invalid credentials");
    });
  });

  it("shows loading state during submission", async () => {
    mockSignInEmail.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <Login />);
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "t@t.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Signing in");
    });
  });

  it("shows email verification prompt", async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: "Email is not verified", code: "EMAIL_NOT_VERIFIED" } });
    const { container } = render(() => <Login />);
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "t@t.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("verify your email");
    });
  });

  it("shows resend verification button after email not verified", async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: "Email is not verified", code: "EMAIL_NOT_VERIFIED" } });
    const { container } = render(() => <Login />);
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "user@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Resend verification email");
    });
  });

  it("calls sendVerificationEmail when resend clicked", async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: "Email is not verified", code: "EMAIL_NOT_VERIFIED" } });
    mockSendVerificationEmail.mockResolvedValue({ error: null });
    const { container } = render(() => <Login />);
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "user@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Resend verification email");
    });
    const resendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Resend verification email"),
    )!;
    fireEvent.click(resendBtn);
    await vi.waitFor(() => {
      expect(mockSendVerificationEmail).toHaveBeenCalledWith({ email: "user@test.com", callbackURL: "/" });
    });
  });

  it("shows default error when authError has no message", async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: "" } });
    const { container } = render(() => <Login />);
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "t@t.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Invalid email or password");
    });
  });

  it("falls back to login form when local session check returns non-ok", async () => {
    const { checkLocalMode } = await import("../../src/services/local-mode.js");
    (checkLocalMode as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    // fetch is already stubbed with { ok: false } in beforeEach

    const { container } = render(() => <Login />);

    // After local mode check + failed session fetch, login form is shown
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Welcome back");
    });
  });

  it("shows resend error when sendVerificationEmail fails", async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: "Email is not verified", code: "EMAIL_NOT_VERIFIED" } });
    mockSendVerificationEmail.mockResolvedValue({ error: { message: "Rate limited" } });
    const { container } = render(() => <Login />);
    fireEvent.input(container.querySelector('input[type="email"]')!, { target: { value: "user@test.com" } });
    fireEvent.input(container.querySelector('input[type="password"]')!, { target: { value: "pass" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Resend verification email");
    });
    const resendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Resend verification email"),
    )!;
    fireEvent.click(resendBtn);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Rate limited");
    });
  });
});
