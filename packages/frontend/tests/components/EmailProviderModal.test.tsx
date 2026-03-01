import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockSetEmailProvider = vi.fn();
const mockTestEmailProvider = vi.fn();
const mockTestSavedEmailProvider = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  setEmailProvider: (...args: unknown[]) => mockSetEmailProvider(...args),
  testEmailProvider: (...args: unknown[]) => mockTestEmailProvider(...args),
  testSavedEmailProvider: (...args: unknown[]) => mockTestSavedEmailProvider(...args),
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

import EmailProviderModal from "../../src/components/EmailProviderModal";

// Portal renders into document.body, so use document.querySelector for all DOM queries
const q = (sel: string) => document.querySelector(sel);

describe("EmailProviderModal", () => {
  const defaultProps = {
    open: true,
    initialProvider: "resend",
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTestEmailProvider.mockResolvedValue({ success: true });
    mockTestSavedEmailProvider.mockResolvedValue({ success: true });
    mockSetEmailProvider.mockResolvedValue({});
  });

  it("does not render when closed", () => {
    render(() => <EmailProviderModal {...defaultProps} open={false} />);
    expect(q(".modal-overlay")).toBeNull();
  });

  it("renders modal when open", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(screen.getByText("Configure email provider")).toBeDefined();
  });

  it("shows 'Edit email provider' title in edit mode", () => {
    render(() => <EmailProviderModal {...defaultProps} editMode={true} />);
    expect(screen.getByText("Edit email provider")).toBeDefined();
  });

  it("shows three provider options", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(screen.getByText("Resend")).toBeDefined();
    expect(screen.getByText("Mailgun")).toBeDefined();
    expect(screen.getByText("SendGrid")).toBeDefined();
  });

  it("shows API Key label", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(screen.getByText("API Key")).toBeDefined();
  });

  it("shows password input for API key in create mode", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(q('input[type="password"]')).not.toBeNull();
  });

  it("shows Notification email field", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(screen.getByText("Notification email")).toBeDefined();
  });

  it("shows 'Test & Connect' button in create mode", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(screen.getByText("Test & Connect")).toBeDefined();
  });

  it("shows 'Test & Save' button in edit mode", () => {
    render(() => <EmailProviderModal {...defaultProps} editMode={true} />);
    expect(screen.getByText("Test & Save")).toBeDefined();
  });

  it("shows 'Send test email' button", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(screen.getByText("Send test email")).toBeDefined();
  });

  it("buttons are disabled when API key is empty", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    const primaryBtn = q(".btn--primary") as HTMLButtonElement;
    expect(primaryBtn.disabled).toBe(true);
  });

  it("buttons become enabled when API key is entered", async () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "re_testkey12345" } });
    await vi.waitFor(() => {
      const primaryBtn = q(".btn--primary") as HTMLButtonElement;
      expect(primaryBtn.disabled).toBe(false);
    });
  });

  it("shows domain field when Mailgun is selected", async () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    const mailgunBtn = screen.getByText("Mailgun");
    fireEvent.click(mailgunBtn);
    await vi.waitFor(() => {
      expect(screen.getByText("Sending domain")).toBeDefined();
    });
  });

  it("does not show domain field for Resend", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    expect(document.body.textContent).not.toContain("Sending domain");
  });

  it("calls onClose when overlay is clicked", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    const overlay = q(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    const input = q('input[type="password"]')!;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // --- Masked key (edit mode with existing key) ---

  it("shows masked key in edit mode with existing key prefix", () => {
    render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    expect(document.body.textContent).toContain("re_abc12");
    expect(q(".masked-key")).not.toBeNull();
  });

  it("shows Change button in edit mode with existing key", () => {
    render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    expect(screen.getByText("Change")).toBeDefined();
  });

  it("does not show password input when masked key is displayed", () => {
    render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    expect(q('input[type="password"]')).toBeNull();
  });

  it("shows password input after clicking Change", async () => {
    render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    fireEvent.click(screen.getByText("Change"));
    await vi.waitFor(() => {
      expect(q('input[type="password"]')).not.toBeNull();
    });
  });

  it("buttons are NOT disabled in edit mode with existing key (no new key required)", () => {
    render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    const primaryBtn = q(".btn--primary") as HTMLButtonElement;
    expect(primaryBtn.disabled).toBe(false);
  });

  it("calls testSavedEmailProvider when testing with existing key", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        existingKeyPrefix="re_abc12"
        existingNotificationEmail="user@test.com"
      />
    ));
    const testBtn = screen.getByText("Send test email");
    fireEvent.click(testBtn);
    await vi.waitFor(() => {
      expect(mockTestSavedEmailProvider).toHaveBeenCalledWith("user@test.com");
    });
  });

  it("calls testEmailProvider (not saved) when a new key is entered", async () => {
    render(() => (
      <EmailProviderModal {...defaultProps} />
    ));
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "re_testkey12345" } });
    const testBtn = screen.getByText("Send test email");
    fireEvent.click(testBtn);
    await vi.waitFor(() => {
      expect(mockTestEmailProvider).toHaveBeenCalled();
      expect(mockTestSavedEmailProvider).not.toHaveBeenCalled();
    });
  });

  it("save with existing key does not send apiKey to backend", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        existingKeyPrefix="re_abc12"
        existingNotificationEmail="user@test.com"
      />
    ));
    const saveBtn = screen.getByText("Test & Save");
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(mockSetEmailProvider).toHaveBeenCalledWith(
        expect.not.objectContaining({ apiKey: expect.anything() }),
      );
    });
  });

  it("save with new key sends apiKey to backend", async () => {
    render(() => (
      <EmailProviderModal {...defaultProps} />
    ));
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "re_testkey12345" } });
    const saveBtn = screen.getByText("Test & Connect");
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(mockSetEmailProvider).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "re_testkey12345" }),
      );
    });
  });

  // --- Provider switching security (API key leak prevention) ---

  it("does NOT show masked key when switching to a different provider", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        initialProvider="resend"
        existingKeyPrefix="re_abc12"
      />
    ));

    // Initially shows masked key for Resend
    expect(q(".masked-key")).not.toBeNull();

    // Switch to Mailgun
    fireEvent.click(screen.getByText("Mailgun"));

    await vi.waitFor(() => {
      // Masked key should NOT be shown for a different provider
      expect(q(".masked-key")).toBeNull();
    });
  });

  it("shows empty password input after switching to different provider", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        initialProvider="resend"
        existingKeyPrefix="re_abc12"
      />
    ));

    // Switch to SendGrid
    fireEvent.click(screen.getByText("SendGrid"));

    await vi.waitFor(() => {
      const input = q('input[type="password"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe("");
    });
  });

  it("re-shows masked key when switching back to original provider", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        initialProvider="resend"
        existingKeyPrefix="re_abc12"
      />
    ));

    // Switch away
    fireEvent.click(screen.getByText("Mailgun"));
    await vi.waitFor(() => {
      expect(q(".masked-key")).toBeNull();
    });

    // Switch back
    fireEvent.click(screen.getByText("Resend"));
    await vi.waitFor(() => {
      expect(q(".masked-key")).not.toBeNull();
      expect(document.body.textContent).toContain("re_abc12");
    });
  });

  it("save button is disabled when switched to different provider without entering key", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        initialProvider="resend"
        existingKeyPrefix="re_abc12"
      />
    ));

    // Initially enabled (keeping existing key)
    const primaryBtn = q(".btn--primary") as HTMLButtonElement;
    expect(primaryBtn.disabled).toBe(false);

    // Switch to Mailgun — no key entered yet
    fireEvent.click(screen.getByText("Mailgun"));

    await vi.waitFor(() => {
      const btn = q(".btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  it("calls testEmailProvider (not testSavedEmailProvider) when provider differs from initial", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        initialProvider="resend"
        existingKeyPrefix="re_abc12"
        existingNotificationEmail="user@test.com"
      />
    ));

    // Switch to SendGrid and enter a new key
    fireEvent.click(screen.getByText("SendGrid"));
    await vi.waitFor(() => {
      expect(q('input[type="password"]')).not.toBeNull();
    });
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "SG.newkeyhere12345" } });

    fireEvent.click(screen.getByText("Send test email"));

    await vi.waitFor(() => {
      expect(mockTestEmailProvider).toHaveBeenCalled();
      expect(mockTestSavedEmailProvider).not.toHaveBeenCalled();
    });
  });

  it("sends new apiKey to backend when saving with a different provider", async () => {
    render(() => (
      <EmailProviderModal
        {...defaultProps}
        editMode={true}
        initialProvider="resend"
        existingKeyPrefix="re_abc12"
        existingNotificationEmail="user@test.com"
      />
    ));

    // Switch to SendGrid and enter a new key
    fireEvent.click(screen.getByText("SendGrid"));
    await vi.waitFor(() => {
      expect(q('input[type="password"]')).not.toBeNull();
    });
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "SG.newkeyhere12345" } });

    fireEvent.click(screen.getByText("Test & Save"));

    await vi.waitFor(() => {
      expect(mockSetEmailProvider).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "sendgrid", apiKey: "SG.newkeyhere12345" }),
      );
    });
  });

  it("pre-populates notification email from props", () => {
    render(() => (
      <EmailProviderModal {...defaultProps} existingNotificationEmail="custom@email.com" />
    ));
    const emailInput = q('input[type="email"]') as HTMLInputElement;
    expect(emailInput.value).toBe("custom@email.com");
  });

  it("pre-populates domain from props", () => {
    render(() => (
      <EmailProviderModal {...defaultProps} initialProvider="mailgun" existingDomain="mg.example.com" />
    ));
    const domainInput = q('input[type="text"]') as HTMLInputElement;
    expect(domainInput.value).toBe("mg.example.com");
  });

  it("shows validation error for empty API key on save attempt", async () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    // Enter short key to trigger validation
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "short" } });
    const saveBtn = q(".btn--primary")!;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("API key must be at least 8 characters");
    });
  });

  it("shows validation error for invalid Resend key prefix", async () => {
    render(() => <EmailProviderModal {...defaultProps} />);
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "wrong_prefix_key" } });
    const saveBtn = q(".btn--primary")!;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Resend API key must start with re_");
    });
  });

  it("shows validation error for invalid SendGrid key prefix", async () => {
    render(() => (
      <EmailProviderModal {...defaultProps} initialProvider="sendgrid" />
    ));
    const input = q('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "wrong_prefix_key" } });
    const saveBtn = q(".btn--primary")!;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("SendGrid API key must start with SG.");
    });
  });
});
