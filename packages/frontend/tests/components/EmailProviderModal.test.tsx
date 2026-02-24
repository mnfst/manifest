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
    const { container } = render(() => <EmailProviderModal {...defaultProps} open={false} />);
    expect(container.querySelector(".modal-overlay")).toBeNull();
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
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    const input = container.querySelector('input[type="password"]');
    expect(input).toBeDefined();
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
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    const primaryBtn = container.querySelector(".btn--primary") as HTMLButtonElement;
    expect(primaryBtn.disabled).toBe(true);
  });

  it("buttons become enabled when API key is entered", async () => {
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    const input = container.querySelector('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "re_testkey12345" } });
    await vi.waitFor(() => {
      const primaryBtn = container.querySelector(".btn--primary") as HTMLButtonElement;
      expect(primaryBtn.disabled).toBe(false);
    });
  });

  it("shows domain field when Mailgun is selected", async () => {
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    const mailgunBtn = screen.getByText("Mailgun");
    fireEvent.click(mailgunBtn);
    await vi.waitFor(() => {
      expect(screen.getByText("Sending domain")).toBeDefined();
    });
  });

  it("does not show domain field for Resend", () => {
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    expect(container.textContent).not.toContain("Sending domain");
  });

  it("calls onClose when overlay is clicked", () => {
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    const input = container.querySelector('input[type="password"]')!;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // --- Masked key (edit mode with existing key) ---

  it("shows masked key in edit mode with existing key prefix", () => {
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    expect(container.textContent).toContain("re_abc12");
    expect(container.querySelector(".masked-key")).toBeDefined();
  });

  it("shows Change button in edit mode with existing key", () => {
    render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    expect(screen.getByText("Change")).toBeDefined();
  });

  it("does not show password input when masked key is displayed", () => {
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it("shows password input after clicking Change", async () => {
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    fireEvent.click(screen.getByText("Change"));
    await vi.waitFor(() => {
      expect(container.querySelector('input[type="password"]')).not.toBeNull();
    });
  });

  it("buttons are NOT disabled in edit mode with existing key (no new key required)", () => {
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} editMode={true} existingKeyPrefix="re_abc12" />
    ));
    const primaryBtn = container.querySelector(".btn--primary") as HTMLButtonElement;
    expect(primaryBtn.disabled).toBe(false);
  });

  it("calls testSavedEmailProvider when testing with existing key", async () => {
    const { container } = render(() => (
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
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} />
    ));
    const input = container.querySelector('input[type="password"]')!;
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
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} />
    ));
    const input = container.querySelector('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "re_testkey12345" } });
    const saveBtn = screen.getByText("Test & Connect");
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(mockSetEmailProvider).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "re_testkey12345" }),
      );
    });
  });

  it("pre-populates notification email from props", () => {
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} existingNotificationEmail="custom@email.com" />
    ));
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    expect(emailInput.value).toBe("custom@email.com");
  });

  it("pre-populates domain from props", () => {
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} initialProvider="mailgun" existingDomain="mg.example.com" />
    ));
    const domainInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(domainInput.value).toBe("mg.example.com");
  });

  it("shows validation error for empty API key on save attempt", async () => {
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    // Enter and clear to trigger validation
    const input = container.querySelector('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "short" } });
    const saveBtn = container.querySelector(".btn--primary")!;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("API key must be at least 8 characters");
    });
  });

  it("shows validation error for invalid Resend key prefix", async () => {
    const { container } = render(() => <EmailProviderModal {...defaultProps} />);
    const input = container.querySelector('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "wrong_prefix_key" } });
    const saveBtn = container.querySelector(".btn--primary")!;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Resend API key must start with re_");
    });
  });

  it("shows validation error for invalid SendGrid key prefix", async () => {
    const { container } = render(() => (
      <EmailProviderModal {...defaultProps} initialProvider="sendgrid" />
    ));
    const input = container.querySelector('input[type="password"]')!;
    fireEvent.input(input, { target: { value: "wrong_prefix_key" } });
    const saveBtn = container.querySelector(".btn--primary")!;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("SendGrid API key must start with SG.");
    });
  });
});
