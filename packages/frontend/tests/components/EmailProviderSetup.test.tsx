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
    expect(screen.getByText("Email API")).toBeDefined();
    expect(screen.getByText("Transactional email")).toBeDefined();
    expect(screen.getByText("Email delivery")).toBeDefined();
  });

  it("renders provider logos", () => {
    const { container } = render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    const logos = container.querySelectorAll(".provider-setup-card__logo");
    expect(logos.length).toBe(3);
  });

  it("opens modal when Resend card is clicked", async () => {
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    fireEvent.click(screen.getByText("Resend"));
    await vi.waitFor(() => {
      expect(document.querySelector(".modal-overlay")).not.toBeNull();
    });
  });

  it("opens modal when Mailgun card is clicked", async () => {
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    fireEvent.click(screen.getByText("Mailgun"));
    await vi.waitFor(() => {
      expect(document.querySelector(".modal-overlay")).not.toBeNull();
    });
  });

  it("opens modal when SendGrid card is clicked", async () => {
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    fireEvent.click(screen.getByText("SendGrid"));
    await vi.waitFor(() => {
      expect(document.querySelector(".modal-overlay")).not.toBeNull();
    });
  });

  it("passes onConfigured as onSaved to EmailProviderModal", async () => {
    // The EmailProviderSetup passes props.onConfigured as the onSaved prop
    // to EmailProviderModal. We verify the modal receives the correct provider.
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    // Open with SendGrid
    fireEvent.click(screen.getByText("SendGrid"));
    await vi.waitFor(() => {
      expect(document.querySelector(".modal-overlay")).not.toBeNull();
    });
    // The modal should show "SendGrid" as selected
    const sendgridOption = document.querySelector(".provider-modal-option--active");
    expect(sendgridOption?.textContent).toContain("SendGrid");
  });

  it("calls onConfigured when email provider is saved successfully", async () => {
    const { testEmailProvider, setEmailProvider } = await import("../../src/services/api.js");
    (testEmailProvider as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (setEmailProvider as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(() => <EmailProviderSetup onConfigured={onConfigured} />);
    // Open Resend modal
    fireEvent.click(screen.getByText("Resend"));
    await vi.waitFor(() => {
      expect(document.querySelector(".modal-overlay")).not.toBeNull();
    });
    // Enter API key
    const keyInput = document.querySelector('input[type="password"]')!;
    fireEvent.input(keyInput, { target: { value: "re_testkey12345" } });
    // Click Test & Save
    const saveBtn = document.querySelector(".btn--primary")!;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(onConfigured).toHaveBeenCalled();
    });
  });
});
