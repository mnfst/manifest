import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import ProviderKeyForm from "../../src/components/ProviderKeyForm";
import { getProvider } from "../../src/services/providers";

const mockConnectProvider = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  connectProvider: (...args: unknown[]) => mockConnectProvider(...args),
  disconnectProvider: vi.fn().mockResolvedValue({ notifications: [] }),
  revokeOpenaiOAuth: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe("ProviderKeyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectProvider.mockResolvedValue({});
  });

  it("validates API-key subscription providers with API key rules", async () => {
    const [busy, setBusy] = createSignal(false);
    const [keyInput, setKeyInput] = createSignal("short");
    const [editing, setEditing] = createSignal(false);
    const [validationError, setValidationError] = createSignal<string | null>(null);
    const provider = getProvider("zai")!;

    render(() => (
      <ProviderKeyForm
        provDef={provider}
        provId="zai"
        agentName="agent-1"
        isSubMode={() => true}
        connected={() => false}
        selectedAuthType={() => "subscription"}
        busy={busy}
        setBusy={setBusy}
        keyInput={keyInput}
        setKeyInput={setKeyInput}
        editing={editing}
        setEditing={setEditing}
        validationError={validationError}
        setValidationError={setValidationError}
        getKeyPrefixDisplay={() => ""}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
      />
    ));

    expect(screen.getByText("API Key")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Key is too short (minimum 30 characters)")).toBeDefined();
    expect(mockConnectProvider).not.toHaveBeenCalled();
  });
});
