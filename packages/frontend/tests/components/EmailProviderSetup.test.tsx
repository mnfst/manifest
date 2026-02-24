import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({
  setEmailProvider: vi.fn(),
  testEmailProvider: vi.fn(),
  testSavedEmailProvider: vi.fn(),
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { email: "user@test.com" } },
      isPending: false,
    }),
  },
}));

vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => false,
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import EmailProviderSetup from "../../src/components/EmailProviderSetup";

describe("EmailProviderSetup", () => {
  const onConfigured = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title", () => {
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    expect(screen.getByText("Configure email provider")).toBeDefined();
  });

  it("renders subtitle", () => {
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    expect(screen.getByText("Choose a service to send alert notifications via email.")).toBeDefined();
  });

  it("renders three provider cards", () => {
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    expect(screen.getByText("Resend")).toBeDefined();
    expect(screen.getByText("Mailgun")).toBeDefined();
    expect(screen.getByText("SendGrid")).toBeDefined();
  });

  it("renders provider descriptions", () => {
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    expect(screen.getByText("Modern email API")).toBeDefined();
    expect(screen.getByText("Reliable email service")).toBeDefined();
    expect(screen.getByText("Scalable email delivery")).toBeDefined();
  });

  it("renders provider logos", () => {
    const { container } = render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    const logos = container.querySelectorAll(".provider-setup-card__logo");
    expect(logos.length).toBe(3);
  });

  it("opens modal when Resend card is clicked", async () => {
    const { container } = render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    fireEvent.click(screen.getByText("Resend"));
    await vi.waitFor(() => {
      expect(container.querySelector(".modal-overlay")).not.toBeNull();
    });
  });

  it("opens modal when Mailgun card is clicked", async () => {
    const { container } = render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    fireEvent.click(screen.getByText("Mailgun"));
    await vi.waitFor(() => {
      expect(container.querySelector(".modal-overlay")).not.toBeNull();
    });
  });

  it("opens modal when SendGrid card is clicked", async () => {
    const { container } = render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    fireEvent.click(screen.getByText("SendGrid"));
    await vi.waitFor(() => {
      expect(container.querySelector(".modal-overlay")).not.toBeNull();
    });
  });
});
