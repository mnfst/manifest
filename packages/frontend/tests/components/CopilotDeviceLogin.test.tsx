import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({
  copilotDeviceCode: vi.fn(),
  copilotPollToken: vi.fn(),
  disconnectProvider: vi.fn(),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null, customProviderLogo: () => null,
}));

import CopilotDeviceLogin from "../../src/components/CopilotDeviceLogin";
import {
  copilotDeviceCode,
  copilotPollToken,
  disconnectProvider,
} from "../../src/services/api.js";
import { toast } from "../../src/services/toast-store.js";

const mockCopilotDeviceCode = copilotDeviceCode as ReturnType<typeof vi.fn>;
const mockCopilotPollToken = copilotPollToken as ReturnType<typeof vi.fn>;
const mockDisconnectProvider = disconnectProvider as ReturnType<typeof vi.fn>;
const mockToast = toast as { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

function renderComponent(overrides: Partial<Parameters<typeof CopilotDeviceLogin>[0]> = {}) {
  const props = {
    agentName: "test-agent",
    connected: false,
    onBack: vi.fn(),
    onConnected: vi.fn(),
    onDisconnected: vi.fn(),
    ...overrides,
  };
  const result = render(() => <CopilotDeviceLogin {...props} />);
  return { ...result, props };
}

describe("CopilotDeviceLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("shows Sign in button in idle state", () => {
    renderComponent();
    expect(screen.getByText("Sign in with GitHub")).toBeDefined();
    expect(screen.getByText(/Requires an active GitHub Copilot subscription/)).toBeDefined();
  });

  it("calls onBack when back button is clicked", async () => {
    const { props } = renderComponent();
    await fireEvent.click(screen.getByLabelText("Back to providers"));
    expect(props.onBack).toHaveBeenCalled();
  });

  it("shows loading state after clicking Sign in", async () => {
    mockCopilotDeviceCode.mockReturnValue(new Promise(() => {})); // never resolves
    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));
    // Sign in button should be gone, loading spinner appears
    expect(screen.queryByText("Sign in with GitHub")).toBeNull();
    expect(document.querySelector(".spinner")).toBeTruthy();
  });

  it("shows device code and Open GitHub button in awaiting state", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    // Never resolve poll so we stay in awaiting
    mockCopilotPollToken.mockReturnValue(new Promise(() => {}));

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    await waitFor(() => {
      expect(screen.getByText("ABCD-1234")).toBeDefined();
    });
    expect(screen.getByText(/Copy the code, then open GitHub/)).toBeDefined();
    expect(screen.getByText("Open GitHub")).toBeDefined();
    expect(screen.getByText("Waiting for authorization...")).toBeDefined();

    const link = screen.getByText("Open GitHub").closest("a");
    expect(link).toBeDefined();
    expect(link!.getAttribute("href")).toBe("https://github.com/login/device");
    expect(link!.getAttribute("target")).toBe("_blank");
  });

  it("shows copy button for device code", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken.mockReturnValue(new Promise(() => {}));

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    await waitFor(() => {
      expect(screen.getByLabelText("Copy device code")).toBeDefined();
    });
  });

  it("shows error when device code request fails", async () => {
    mockCopilotDeviceCode.mockRejectedValue(new Error("Network error"));

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    await waitFor(() => {
      expect(screen.getByText("Failed to start GitHub login. Please try again.")).toBeDefined();
    });
    // Sign in button should reappear for retry
    expect(screen.getByText("Sign in with GitHub")).toBeDefined();
  });

  it("transitions to success when poll returns complete", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken.mockResolvedValue({ status: "complete" });

    const { props } = renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    // Advance timer to trigger the first poll
    await vi.advanceTimersByTimeAsync(5000);

    await waitFor(() => {
      expect(screen.getByText("GitHub Copilot connected successfully.")).toBeDefined();
    });
    expect(mockToast.success).toHaveBeenCalledWith("GitHub Copilot connected");
    expect(props.onConnected).toHaveBeenCalled();
  });

  it("shows error when poll returns expired", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken.mockResolvedValue({ status: "expired" });

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));
    await vi.advanceTimersByTimeAsync(5000);

    await waitFor(() => {
      expect(screen.getByText("Device code expired. Please try again.")).toBeDefined();
    });
  });

  it("shows error when poll returns denied", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken.mockResolvedValue({ status: "denied" });

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));
    await vi.advanceTimersByTimeAsync(5000);

    await waitFor(() => {
      expect(screen.getByText("Authorization was denied.")).toBeDefined();
    });
  });

  it("shows connection lost after MAX_POLL_ERRORS consecutive failures", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken.mockRejectedValue(new Error("Network error"));

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    // Advance through 5 failed poll attempts (5 seconds each)
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(5000);
    }

    await waitFor(() => {
      expect(screen.getByText("Connection lost. Please try again.")).toBeDefined();
    });
  });

  it("shows connected state with disconnect button", () => {
    renderComponent({ connected: true });
    expect(screen.getByText("Connected via GitHub device login.")).toBeDefined();
    expect(screen.getByText("Disconnect")).toBeDefined();
  });

  it("calls onDisconnected when disconnect is clicked", async () => {
    mockDisconnectProvider.mockResolvedValue({});

    const { props } = renderComponent({ connected: true });
    await fireEvent.click(screen.getByText("Disconnect"));

    await waitFor(() => {
      expect(props.onDisconnected).toHaveBeenCalled();
    });
    expect(mockDisconnectProvider).toHaveBeenCalledWith("test-agent", "copilot", "subscription");
  });

  it("shows notification toasts on disconnect with notifications", async () => {
    mockDisconnectProvider.mockResolvedValue({
      notifications: ["Tier affected"],
    });

    renderComponent({ connected: true });
    await fireEvent.click(screen.getByText("Disconnect"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Tier affected");
    });
  });

  it("handles disconnect failure gracefully", async () => {
    mockDisconnectProvider.mockRejectedValue(new Error("fail"));

    const { props } = renderComponent({ connected: true });
    await fireEvent.click(screen.getByText("Disconnect"));

    await waitFor(() => {
      // Should not crash — onDisconnected should NOT be called
      expect(props.onDisconnected).not.toHaveBeenCalled();
    });
  });

  it("copies device code to clipboard on copy button click", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "COPY-ME",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken.mockReturnValue(new Promise(() => {}));

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    await waitFor(() => {
      expect(screen.getByLabelText("Copy device code")).toBeDefined();
    });

    await fireEvent.click(screen.getByLabelText("Copy device code"));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("COPY-ME");
    });
    // After successful copy, label changes to "Copied"
    await waitFor(() => {
      expect(screen.getByLabelText("Copied")).toBeDefined();
    });

    // After timeout, label reverts to "Copy device code"
    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => {
      expect(screen.getByLabelText("Copy device code")).toBeDefined();
    });
  });

  it("handles clipboard write failure gracefully", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "FAIL-COPY",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken.mockReturnValue(new Promise(() => {}));

    renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    await waitFor(() => {
      expect(screen.getByLabelText("Copy device code")).toBeDefined();
    });

    await fireEvent.click(screen.getByLabelText("Copy device code"));

    // Should not crash — label stays "Copy device code" (not "Copied")
    await waitFor(() => {
      expect(screen.getByLabelText("Copy device code")).toBeDefined();
    });
  });

  it("increases poll delay on slow_down status", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    // First poll: slow_down, second poll: complete
    mockCopilotPollToken
      .mockResolvedValueOnce({ status: "slow_down" })
      .mockResolvedValueOnce({ status: "complete" });

    const { props } = renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    // First poll at 5 seconds
    await vi.advanceTimersByTimeAsync(5000);
    await waitFor(() => {
      expect(mockCopilotPollToken).toHaveBeenCalledTimes(1);
    });

    // After slow_down, delay increases by 5 -> next poll at 10 seconds
    await vi.advanceTimersByTimeAsync(10000);

    await waitFor(() => {
      expect(screen.getByText("GitHub Copilot connected successfully.")).toBeDefined();
    });
    expect(props.onConnected).toHaveBeenCalled();
  });

  it("continues polling on pending status with same delay", async () => {
    mockCopilotDeviceCode.mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
    mockCopilotPollToken
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "complete" });

    const { props } = renderComponent();
    await fireEvent.click(screen.getByText("Sign in with GitHub"));

    // First poll at 5 seconds — returns pending
    await vi.advanceTimersByTimeAsync(5000);
    await waitFor(() => {
      expect(mockCopilotPollToken).toHaveBeenCalledTimes(1);
    });

    // Second poll at 5 more seconds — same delay for pending
    await vi.advanceTimersByTimeAsync(5000);

    await waitFor(() => {
      expect(screen.getByText("GitHub Copilot connected successfully.")).toBeDefined();
    });
    expect(props.onConnected).toHaveBeenCalled();
  });
});
