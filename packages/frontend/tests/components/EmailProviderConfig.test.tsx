import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockGetEmailConfig = vi.fn();
const mockSaveEmailConfig = vi.fn();
const mockTestEmailConfig = vi.fn();
const mockClearEmailConfig = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getEmailConfig: (...args: unknown[]) => mockGetEmailConfig(...args),
  saveEmailConfig: (...args: unknown[]) => mockSaveEmailConfig(...args),
  testEmailConfig: (...args: unknown[]) => mockTestEmailConfig(...args),
  clearEmailConfig: (...args: unknown[]) => mockClearEmailConfig(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { email: "test@example.com", name: "Test User", id: "u1" } },
    }),
  },
}));

import EmailProviderConfig from "../../src/components/EmailProviderConfig";

describe("EmailProviderConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the email provider section title", async () => {
    mockGetEmailConfig.mockResolvedValue({ configured: false });
    render(() => <EmailProviderConfig />);
    expect(screen.getByText("Email Provider")).toBeDefined();
  });

  it("renders provider dropdown", async () => {
    mockGetEmailConfig.mockResolvedValue({ configured: false });
    const { container } = render(() => <EmailProviderConfig />);
    await vi.waitFor(() => {
      const select = container.querySelector("select");
      expect(select).not.toBeNull();
    });
  });

  it("renders API key input", async () => {
    mockGetEmailConfig.mockResolvedValue({ configured: false });
    const { container } = render(() => <EmailProviderConfig />);
    await vi.waitFor(() => {
      const input = container.querySelector('input[type="password"]');
      expect(input).not.toBeNull();
    });
  });

  it("shows success banner when configured", async () => {
    mockGetEmailConfig.mockResolvedValue({ configured: true, provider: "resend" });
    const { container } = render(() => <EmailProviderConfig />);
    await vi.waitFor(() => {
      const banner = container.querySelector(".waiting-banner--success");
      expect(banner).not.toBeNull();
    });
  });

  it("shows domain field only when Mailgun is selected", async () => {
    mockGetEmailConfig.mockResolvedValue({ configured: false });
    const { container } = render(() => <EmailProviderConfig />);

    await vi.waitFor(() => {
      expect(container.querySelector("select")).not.toBeNull();
    });

    const select = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "mailgun" } });

    await vi.waitFor(() => {
      expect(container.querySelector('input[placeholder="mg.example.com"]')).not.toBeNull();
    });
  });

  it("save button is disabled when API key is empty", async () => {
    mockGetEmailConfig.mockResolvedValue({ configured: false });
    const { container } = render(() => <EmailProviderConfig />);

    await vi.waitFor(() => {
      const saveBtn = Array.from(container.querySelectorAll("button.btn--primary")).find(
        (b) => b.textContent?.includes("Save"),
      ) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });
  });

  it("shows Remove button when configured", async () => {
    mockGetEmailConfig.mockResolvedValue({ configured: true, provider: "resend" });
    const { container } = render(() => <EmailProviderConfig />);

    await vi.waitFor(() => {
      const removeBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Remove"),
      );
      expect(removeBtn).toBeDefined();
    });
  });
});
