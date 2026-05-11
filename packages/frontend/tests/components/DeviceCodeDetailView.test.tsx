import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSignal } from "solid-js";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({
  connectProvider: vi.fn(),
  disconnectProvider: vi.fn(),
  pollMinimaxOAuth: vi.fn(),
  startMinimaxOAuth: vi.fn(),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import DeviceCodeDetailView from "../../src/components/DeviceCodeDetailView";
import { connectProvider } from "../../src/services/api.js";
import { toast } from "../../src/services/toast-store.js";
import { getProvider } from "../../src/services/provider-utils";
import type { AuthType } from "../../src/services/api.js";

const mockConnectProvider = connectProvider as ReturnType<typeof vi.fn>;
const mockToast = toast as {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
};

function renderMinimax() {
  const provDef = getProvider("minimax")!;
  const [busy, setBusy] = createSignal(false);
  const [authType] = createSignal<AuthType>("subscription");
  const props = {
    provDef,
    provId: "minimax",
    agentName: "test-agent",
    connected: () => false,
    selectedAuthType: authType,
    busy,
    setBusy,
    onBack: vi.fn(),
    onUpdate: vi.fn(),
    onClose: vi.fn(),
  };
  const result = render(() => <DeviceCodeDetailView {...props} />);
  return { ...result, props };
}

describe("DeviceCodeDetailView — MiniMax Coding Plan token alternative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the alternative token paste box for MiniMax", () => {
    renderMinimax();
    expect(screen.getByLabelText("MiniMax Coding Plan token")).toBeDefined();
    expect(screen.getByText("Connect with token")).toBeDefined();
  });

  it("rejects a token that doesn't start with sk-cp-", async () => {
    renderMinimax();
    const input = screen.getByLabelText("MiniMax Coding Plan token") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "sk-wrong-token-long-enough" } });
    await fireEvent.click(screen.getByText("Connect with token"));
    await waitFor(() => {
      expect(
        screen.getByText('MiniMax subscription tokens start with "sk-cp-"'),
      ).toBeDefined();
    });
    expect(mockConnectProvider).not.toHaveBeenCalled();
  });

  it("connects with a valid sk-cp- token, defaulting to global region", async () => {
    mockConnectProvider.mockResolvedValueOnce(undefined);
    const { props } = renderMinimax();
    const input = screen.getByLabelText("MiniMax Coding Plan token") as HTMLInputElement;
    const validToken = "sk-cp-" + "a".repeat(40);
    await fireEvent.input(input, { target: { value: validToken } });
    await fireEvent.click(screen.getByText("Connect with token"));
    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
        provider: "minimax",
        apiKey: validToken,
        authType: "subscription",
        region: "global",
      });
    });
    expect(mockToast.success).toHaveBeenCalledWith("MiniMax subscription connected");
    expect(props.onUpdate).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("forwards the selected CN region with the pasted token", async () => {
    mockConnectProvider.mockResolvedValueOnce(undefined);
    renderMinimax();
    const regionSelect = screen.getByLabelText("Region") as HTMLSelectElement;
    await fireEvent.change(regionSelect, { target: { value: "cn" } });
    const input = screen.getByLabelText("MiniMax Coding Plan token") as HTMLInputElement;
    const validToken = "sk-cp-" + "d".repeat(40);
    await fireEvent.input(input, { target: { value: validToken } });
    await fireEvent.click(screen.getByText("Connect with token"));
    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
        provider: "minimax",
        apiKey: validToken,
        authType: "subscription",
        region: "cn",
      });
    });
  });

  it("submits the token on Enter key", async () => {
    mockConnectProvider.mockResolvedValueOnce(undefined);
    renderMinimax();
    const input = screen.getByLabelText("MiniMax Coding Plan token") as HTMLInputElement;
    const validToken = "sk-cp-" + "b".repeat(40);
    await fireEvent.input(input, { target: { value: validToken } });
    await fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalled();
    });
  });

  it("disables Connect when input is empty", () => {
    renderMinimax();
    const button = screen.getByText("Connect with token").closest("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("does not close on connect failure and resets busy", async () => {
    mockConnectProvider.mockRejectedValueOnce(new Error("boom"));
    const { props } = renderMinimax();
    const input = screen.getByLabelText("MiniMax Coding Plan token") as HTMLInputElement;
    const validToken = "sk-cp-" + "c".repeat(40);
    await fireEvent.input(input, { target: { value: validToken } });
    await fireEvent.click(screen.getByText("Connect with token"));
    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalled();
    });
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("clears validation error when user edits the input", async () => {
    renderMinimax();
    const input = screen.getByLabelText("MiniMax Coding Plan token") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "bad-prefix-long-enough" } });
    await fireEvent.click(screen.getByText("Connect with token"));
    await waitFor(() => {
      expect(
        screen.getByText('MiniMax subscription tokens start with "sk-cp-"'),
      ).toBeDefined();
    });
    await fireEvent.input(input, { target: { value: "sk-cp-fresh" } });
    expect(
      screen.queryByText('MiniMax subscription tokens start with "sk-cp-"'),
    ).toBeNull();
  });
});
