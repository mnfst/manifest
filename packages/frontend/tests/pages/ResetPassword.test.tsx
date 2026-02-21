import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

let mockSearchParamsValue: Record<string, string> = {};
const mockRequestPasswordReset = vi.fn();
const mockResetPassword = vi.fn();

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useSearchParams: () => [new Proxy({}, { get: (_, key) => mockSearchParamsValue[key as string] })],
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
}));

import ResetPassword from "../../src/pages/ResetPassword";

describe("ResetPassword - Request form (no token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsValue = {};
  });

  it("renders reset password heading", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Reset your password")).toBeDefined();
  });

  it("shows email input for request form", () => {
    render(() => <ResetPassword />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeDefined();
  });

  it("shows send reset link button", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Send reset link")).toBeDefined();
  });

  it("shows back to sign in link", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Back to sign in")).toBeDefined();
  });

  it("shows subtitle text", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Enter your email to receive a reset link")).toBeDefined();
  });

  it("email input is required", () => {
    const { container } = render(() => <ResetPassword />);
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    expect(emailInput.required).toBe(true);
  });

  it("back to sign in link points to /login", () => {
    const { container } = render(() => <ResetPassword />);
    const link = container.querySelector('a[href="/login"]');
    expect(link).not.toBeNull();
  });

  it("submits email and shows confirmation", async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: null });
    const { container } = render(() => <ResetPassword />);
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.input(emailInput, { target: { value: "test@test.com" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Check your email for a reset link");
    });
  });

  it("shows error on failed request", async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: { message: "User not found" } });
    const { container } = render(() => <ResetPassword />);
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.input(emailInput, { target: { value: "unknown@test.com" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("User not found");
    });
  });

  it("shows loading state during submission", async () => {
    mockRequestPasswordReset.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <ResetPassword />);
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.input(emailInput, { target: { value: "test@test.com" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Sending...");
    });
  });
});

describe("ResetPassword - Set new password form (with token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsValue = { token: "test-token-123" };
  });

  it("renders set new password heading", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Set new password")).toBeDefined();
  });

  it("shows password and confirm password inputs", () => {
    render(() => <ResetPassword />);
    expect(screen.getByPlaceholderText("Enter new password")).toBeDefined();
    expect(screen.getByPlaceholderText("Confirm new password")).toBeDefined();
  });

  it("shows reset password button", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Reset password")).toBeDefined();
  });

  it("shows subtitle about entering new password", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Enter your new password")).toBeDefined();
  });

  it("password inputs have min length", () => {
    const { container } = render(() => <ResetPassword />);
    const inputs = container.querySelectorAll('input[type="password"]');
    expect((inputs[0] as HTMLInputElement).minLength).toBe(8);
    expect((inputs[1] as HTMLInputElement).minLength).toBe(8);
  });

  it("shows error when passwords do not match", async () => {
    const { container } = render(() => <ResetPassword />);
    const inputs = container.querySelectorAll('input[type="password"]');
    fireEvent.input(inputs[0], { target: { value: "password123" } });
    fireEvent.input(inputs[1], { target: { value: "different456" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Passwords do not match");
    });
  });

  it("calls resetPassword on successful submit", async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    const { container } = render(() => <ResetPassword />);
    const inputs = container.querySelectorAll('input[type="password"]');
    fireEvent.input(inputs[0], { target: { value: "newpass123" } });
    fireEvent.input(inputs[1], { target: { value: "newpass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        newPassword: "newpass123",
        token: "test-token-123",
      });
    });
  });

  it("shows success state after password reset", async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    const { container } = render(() => <ResetPassword />);
    const inputs = container.querySelectorAll('input[type="password"]');
    fireEvent.input(inputs[0], { target: { value: "newpass123" } });
    fireEvent.input(inputs[1], { target: { value: "newpass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Your password has been updated");
    });
  });

  it("shows error on failed reset", async () => {
    mockResetPassword.mockResolvedValue({ error: { message: "Token expired" } });
    const { container } = render(() => <ResetPassword />);
    const inputs = container.querySelectorAll('input[type="password"]');
    fireEvent.input(inputs[0], { target: { value: "newpass123" } });
    fireEvent.input(inputs[1], { target: { value: "newpass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Token expired");
    });
  });

  it("shows loading state during reset", async () => {
    mockResetPassword.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <ResetPassword />);
    const inputs = container.querySelectorAll('input[type="password"]');
    fireEvent.input(inputs[0], { target: { value: "newpass123" } });
    fireEvent.input(inputs[1], { target: { value: "newpass123" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Resetting...");
    });
  });

  it("shows back to sign in link with token", () => {
    render(() => <ResetPassword />);
    expect(screen.getByText("Back to sign in")).toBeDefined();
  });
});
