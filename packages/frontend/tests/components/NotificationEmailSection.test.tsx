import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockGetNotificationEmail = vi.fn();
const mockSaveNotificationEmail = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getNotificationEmail: (...args: unknown[]) => mockGetNotificationEmail(...args),
  saveNotificationEmail: (...args: unknown[]) => mockSaveNotificationEmail(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import NotificationEmailSection from "../../src/components/NotificationEmailSection";

describe("NotificationEmailSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title", async () => {
    mockGetNotificationEmail.mockResolvedValue({ email: null, isDefault: true });
    render(() => <NotificationEmailSection />);
    expect(screen.getByText("Notification Email")).toBeDefined();
  });

  it("shows warning banner when no email is configured", async () => {
    mockGetNotificationEmail.mockResolvedValue({ email: null, isDefault: true });
    const { container } = render(() => <NotificationEmailSection />);

    await vi.waitFor(() => {
      const banner = container.querySelector(".waiting-banner--warning");
      expect(banner).not.toBeNull();
    });
  });

  it("shows success banner when email is configured", async () => {
    mockGetNotificationEmail.mockResolvedValue({ email: "user@real.com", isDefault: false });
    const { container } = render(() => <NotificationEmailSection />);

    await vi.waitFor(() => {
      const banner = container.querySelector(".waiting-banner--success");
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toContain("user@real.com");
    });
  });

  it("save button is disabled when email input is empty", async () => {
    mockGetNotificationEmail.mockResolvedValue({ email: null, isDefault: true });
    const { container } = render(() => <NotificationEmailSection />);

    await vi.waitFor(() => {
      const saveBtn = Array.from(container.querySelectorAll("button.btn--primary")).find(
        (b) => b.textContent?.includes("Save"),
      ) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });
  });

  it("renders email input field", async () => {
    mockGetNotificationEmail.mockResolvedValue({ email: null, isDefault: true });
    const { container } = render(() => <NotificationEmailSection />);

    await vi.waitFor(() => {
      const input = container.querySelector('input[type="email"]');
      expect(input).not.toBeNull();
    });
  });

  it("calls saveNotificationEmail on save", async () => {
    mockGetNotificationEmail.mockResolvedValue({ email: null, isDefault: true });
    mockSaveNotificationEmail.mockResolvedValue({ saved: true });
    const { container } = render(() => <NotificationEmailSection />);

    await vi.waitFor(() => {
      expect(container.querySelector('input[type="email"]')).not.toBeNull();
    });

    const input = container.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new@user.com" } });

    const saveBtn = Array.from(container.querySelectorAll("button.btn--primary")).find(
      (b) => b.textContent?.includes("Save"),
    ) as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await vi.waitFor(() => {
      expect(mockSaveNotificationEmail).toHaveBeenCalledWith("new@user.com");
    });
  });
});
