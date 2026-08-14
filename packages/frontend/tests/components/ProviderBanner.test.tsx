import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({}));

import ProviderBanner from "../../src/components/ProviderBanner";

describe("ProviderBanner", () => {
  const defaultProps = {
    config: {
      provider: "resend",
      domain: null,
      keyPrefix: "re_abc12",
      is_active: true,
      notificationEmail: null,
    },
    onEdit: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders provider name", () => {
    render(() => <ProviderBanner {...defaultProps} />);
    expect(screen.getByText("Resend")).toBeDefined();
  });

  it("renders 'Your provider' label", () => {
    render(() => <ProviderBanner {...defaultProps} />);
    expect(screen.getByText("Your provider")).toBeDefined();
  });

  it("shows key prefix with ellipsis", () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    expect(container.textContent).toContain("re_abc12...");
  });

  it("shows domain when present", () => {
    const props = {
      ...defaultProps,
      config: { ...defaultProps.config, domain: "mg.example.com" },
    };
    const { container } = render(() => <ProviderBanner {...props} />);
    expect(container.textContent).toContain("mg.example.com");
  });

  it("does not show domain when null", () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    expect(container.textContent).not.toContain("mg.example.com");
  });

  it("shows notification email when present", () => {
    const props = {
      ...defaultProps,
      config: { ...defaultProps.config, notificationEmail: "alerts@test.com" },
    };
    const { container } = render(() => <ProviderBanner {...props} />);
    expect(container.textContent).toContain("alerts@test.com");
  });

  it("does not show notification email when null", () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    expect(container.querySelector(".provider-card__email")).toBeNull();
  });

  it("renders provider logo", () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    const img = container.querySelector(".provider-card__logo") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("resend.svg");
  });

  it("renders Mailgun provider", () => {
    const props = {
      ...defaultProps,
      config: { ...defaultProps.config, provider: "mailgun" },
    };
    render(() => <ProviderBanner {...props} />);
    expect(screen.getByText("Mailgun")).toBeDefined();
  });

  it("renders SendGrid provider", () => {
    const props = {
      ...defaultProps,
      config: { ...defaultProps.config, provider: "sendgrid" },
    };
    render(() => <ProviderBanner {...props} />);
    expect(screen.getByText("SendGrid")).toBeDefined();
  });

  it("has menu button", () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    const menuBtn = container.querySelector(".provider-card__menu-btn");
    expect(menuBtn).not.toBeNull();
  });

  it("shows dropdown with Edit and Remove on menu click", async () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    const menuBtn = container.querySelector(".provider-card__menu-btn")!;
    fireEvent.click(menuBtn);
    await vi.waitFor(() => {
      expect(screen.getByText("Edit")).toBeDefined();
      expect(screen.getByText("Remove")).toBeDefined();
    });
  });

  it("calls onEdit when Edit is clicked", async () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    const menuBtn = container.querySelector(".provider-card__menu-btn")!;
    fireEvent.click(menuBtn);
    await vi.waitFor(() => {
      fireEvent.click(screen.getByText("Edit"));
    });
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it("calls onRemove when Remove is clicked", async () => {
    const { container } = render(() => <ProviderBanner {...defaultProps} />);
    const menuBtn = container.querySelector(".provider-card__menu-btn")!;
    fireEvent.click(menuBtn);
    await vi.waitFor(() => {
      fireEvent.click(screen.getByText("Remove"));
    });
    expect(defaultProps.onRemove).toHaveBeenCalled();
  });
});
