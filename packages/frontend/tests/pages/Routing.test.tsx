import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  useNavigate: () => vi.fn(),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(true),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/components/ProviderSelectModal.js", () => ({
  default: (props: any) => (
    <div data-testid="provider-modal">
      <button onClick={props.onClose}>Done</button>
      <button onClick={props.onUpdate} data-testid="trigger-update">Update</button>
    </div>
  ),
}));

const mockGetProviders = vi.fn();
const mockDeactivateAllProviders = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  getTierAssignments: vi.fn().mockResolvedValue([
    { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "3", user_id: "u1", tier: "complex", override_model: "claude-opus-4-6", auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
  ]),
  getAvailableModels: vi.fn().mockResolvedValue([
    { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
    { model_name: "claude-opus-4-6", provider: "Anthropic", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
  ]),
  getProviders: (...args: unknown[]) => mockGetProviders(...args),
  connectProvider: vi.fn().mockResolvedValue({}),
  deactivateAllProviders: (...args: unknown[]) => mockDeactivateAllProviders(...args),
  overrideTier: vi.fn().mockResolvedValue({}),
  resetTier: vi.fn().mockResolvedValue({}),
  resetAllTiers: vi.fn().mockResolvedValue({}),
}));

import Routing from "../../src/pages/Routing";
import { toast } from "../../src/services/toast-store.js";

const { overrideTier, resetTier, resetAllTiers } = await import("../../src/services/api.js");

describe("Routing — enabled state (providers active)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });
  });

  it("renders Routing heading", () => {
    render(() => <Routing />);
    expect(screen.getByText("Routing")).toBeDefined();
  });

  it("renders all four tier labels", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Simple")).toBeDefined();
    expect(screen.getByText("Standard")).toBeDefined();
    expect(screen.getByText("Complex")).toBeDefined();
    expect(screen.getByText("Reasoning")).toBeDefined();
  });

  it("renders tier descriptions", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Heartbeats, greetings, and low-cost tasks that any model can handle.")).toBeDefined();
  });

  it("shows auto tag for non-override tiers", async () => {
    render(() => <Routing />);
    const autoTags = await screen.findAllByText("auto");
    // simple, standard, reasoning are auto (3 tiers); complex has an override
    expect(autoTags.length).toBe(3);
  });

  it("shows Override button for non-override tiers", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    expect(overrideButtons.length).toBe(3);
  });

  it("shows Edit and Reset buttons for override tiers", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Edit")).toBeDefined();
    expect(screen.getByText("Reset")).toBeDefined();
  });

  it("shows Reset all to auto button when overrides exist", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Reset all to auto")).toBeDefined();
  });

  it("shows provider count button", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("1 provider")).toBeDefined();
  });

  it("shows Disable Routing button", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Disable Routing")).toBeDefined();
  });

  it("shows Setup instructions link in footer", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Setup instructions")).toBeDefined();
  });

  it("renders breadcrumb with agent name", () => {
    render(() => <Routing />);
    const matches = screen.getAllByText(/test-agent/);
    const breadcrumb = matches.find((el) => el.classList.contains("breadcrumb"));
    expect(breadcrumb).toBeDefined();
  });

  it("opens model picker when Override button is clicked", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByText("Select a model")).toBeDefined();
  });

  it("opens model picker when Edit button is clicked", async () => {
    render(() => <Routing />);
    const editBtn = await screen.findByText("Edit");
    fireEvent.click(editBtn);
    expect(await screen.findByText("Select a model")).toBeDefined();
  });

  it("shows tier label in model picker subtitle", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    // Click override for 'simple' tier
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByText("Simple tier")).toBeDefined();
  });

  it("closes model picker when close button is clicked", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByText("Select a model")).toBeDefined();

    const closeBtns = screen.getAllByLabelText("Close");
    fireEvent.click(closeBtns[closeBtns.length - 1]);
    // After close, modal title should be gone
    await waitFor(() => {
      expect(screen.queryByText("Select a model")).toBeNull();
    });
  });

  it("closes model picker on overlay click", async () => {
    const { container } = render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByText("Select a model")).toBeDefined();

    const overlays = container.querySelectorAll(".modal-overlay");
    const pickerOverlay = overlays[overlays.length - 1];
    fireEvent.click(pickerOverlay);
    await waitFor(() => {
      expect(screen.queryByText("Select a model")).toBeNull();
    });
  });

  it("closes model picker on Escape key", async () => {
    const { container } = render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByText("Select a model")).toBeDefined();

    const overlays = container.querySelectorAll(".modal-overlay");
    const pickerOverlay = overlays[overlays.length - 1];
    fireEvent.keyDown(pickerOverlay, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Select a model")).toBeNull();
    });
  });

  it("shows search input in model picker", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByLabelText("Search models or providers")).toBeDefined();
  });

  it("filters models by search query", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);

    const searchInput = await screen.findByLabelText("Search models or providers");
    fireEvent.input(searchInput, { target: { value: "gpt" } });

    // Should show OpenAI models, not Anthropic
    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeDefined();
    });
  });

  it("shows 'No models match' when search has no results", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);

    const searchInput = await screen.findByLabelText("Search models or providers");
    fireEvent.input(searchInput, { target: { value: "zzzzzzz" } });

    await waitFor(() => {
      expect(screen.getByText("No models match your search.")).toBeDefined();
    });
  });

  it("selects a model and calls overrideTier", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);
    await screen.findByText("Select a model");

    // Find the claude-opus-4-6 model button (unique in the list)
    const modelButtons = screen.getAllByText("Claude Opus 4.6");
    fireEvent.click(modelButtons[modelButtons.length - 1]);

    await waitFor(() => {
      expect(overrideTier).toHaveBeenCalledWith("simple", "claude-opus-4-6");
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Routing updated");
    });
  });

  it("shows (recommended) label for auto-assigned model", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]); // simple tier, auto is gpt-4o-mini

    await waitFor(() => {
      expect(screen.getByText("(recommended)")).toBeDefined();
    });
  });

  it("calls resetTier when Reset button is clicked", async () => {
    render(() => <Routing />);
    const resetBtn = await screen.findByText("Reset");
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(resetTier).toHaveBeenCalledWith("complex");
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Reset to auto");
    });
  });

  it("calls resetAllTiers when Reset all to auto is clicked", async () => {
    render(() => <Routing />);
    const resetAllBtn = await screen.findByText("Reset all to auto");
    fireEvent.click(resetAllBtn);

    await waitFor(() => {
      expect(resetAllTiers).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("All tiers reset to auto");
    });
  });

  it("opens provider modal when Manage providers button is clicked", async () => {
    render(() => <Routing />);
    const provBtn = await screen.findByLabelText("Manage connected providers");
    fireEvent.click(provBtn);
    expect(screen.getByTestId("provider-modal")).toBeDefined();
  });

  it("calls deactivateAllProviders when Disable Routing is clicked", async () => {
    render(() => <Routing />);
    const disableBtn = await screen.findByText("Disable Routing");
    fireEvent.click(disableBtn);

    await waitFor(() => {
      expect(mockDeactivateAllProviders).toHaveBeenCalled();
    });
  });

  it("opens instruction modal when Setup instructions is clicked", async () => {
    render(() => <Routing />);
    const instrBtn = await screen.findByText("Setup instructions");
    fireEvent.click(instrBtn);
    // RoutingInstructionModal opens — it's mocked in ProviderSelectModal mock
    // but since RoutingInstructionModal is not mocked, it renders inline
    expect(screen.getByText("Activate routing")).toBeDefined();
  });

  it("displays model price labels", async () => {
    render(() => <Routing />);
    // gpt-4o-mini: input 0.00000015 * 1M = $0.15
    await waitFor(() => {
      const text = document.body.textContent || "";
      expect(text).toContain("$0.15");
    });
  });

  it("shows 'No model available' when model is null", async () => {
    const { getTierAssignments } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValueOnce([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, updated_at: "2025-01-01" },
    ]);

    render(() => <Routing />);
    const noModels = await screen.findAllByText("No model available");
    expect(noModels.length).toBe(4);
  });

  it("pluralizes provider count correctly", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);

    render(() => <Routing />);
    expect(await screen.findByText("2 providers")).toBeDefined();
  });
});

describe("Routing — disabled state (no active providers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([]);
  });

  it("shows Enable Routing button when no providers active", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Enable Routing")).toBeDefined();
  });

  it("shows description about smart routing", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Smart model routing")).toBeDefined();
  });

  it("opens provider modal when Enable Routing is clicked", async () => {
    render(() => <Routing />);
    const enableBtn = await screen.findByText("Enable Routing");
    fireEvent.click(enableBtn);
    expect(screen.getByTestId("provider-modal")).toBeDefined();
  });
});

describe("Routing — helper functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });
  });

  it("handles overrideTier error gracefully", async () => {
    vi.mocked(overrideTier).mockRejectedValueOnce(new Error("fail"));
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    fireEvent.click(overrideButtons[0]);
    await screen.findByText("Select a model");

    const modelButtons = screen.getAllByText("Claude Opus 4.6");
    fireEvent.click(modelButtons[modelButtons.length - 1]);

    // Should not throw
    await waitFor(() => {
      expect(overrideTier).toHaveBeenCalled();
    });
  });

  it("handles resetTier error gracefully", async () => {
    vi.mocked(resetTier).mockRejectedValueOnce(new Error("fail"));
    render(() => <Routing />);
    const resetBtn = await screen.findByText("Reset");
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(resetTier).toHaveBeenCalled();
    });
  });

  it("handles resetAllTiers error gracefully", async () => {
    vi.mocked(resetAllTiers).mockRejectedValueOnce(new Error("fail"));
    render(() => <Routing />);
    const resetAllBtn = await screen.findByText("Reset all to auto");
    fireEvent.click(resetAllBtn);

    await waitFor(() => {
      expect(resetAllTiers).toHaveBeenCalled();
    });
  });

  it("handles deactivateAllProviders error gracefully", async () => {
    mockDeactivateAllProviders.mockRejectedValueOnce(new Error("fail"));
    render(() => <Routing />);
    const disableBtn = await screen.findByText("Disable Routing");
    fireEvent.click(disableBtn);

    await waitFor(() => {
      expect(mockDeactivateAllProviders).toHaveBeenCalled();
    });
  });
});

describe("Routing — handleProviderUpdate", () => {
  it("shows instruction modal when routing becomes enabled via provider update", async () => {
    // Start with no active providers (routing disabled)
    mockGetProviders.mockResolvedValue([]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });

    render(() => <Routing />);
    // Enable routing by clicking Enable Routing which opens the provider modal
    const enableBtn = await screen.findByText("Enable Routing");
    fireEvent.click(enableBtn);

    // Now simulate that the provider modal update callback causes routing to become enabled
    // First change the mock so next getProviders fetch returns active providers
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);

    // Click the trigger-update button in the mocked ProviderSelectModal
    const updateBtn = screen.getByTestId("trigger-update");
    fireEvent.click(updateBtn);

    // Instruction modal should appear after routing transitions from disabled to enabled
    await waitFor(() => {
      expect(screen.getByText("Activate routing")).toBeDefined();
    });
  });

  it("does not show instruction modal when routing was already enabled", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });

    render(() => <Routing />);
    // Open provider modal
    const provBtn = await screen.findByLabelText("Manage connected providers");
    fireEvent.click(provBtn);

    // Trigger update (routing was already enabled)
    const updateBtn = screen.getByTestId("trigger-update");
    fireEvent.click(updateBtn);

    // Wait a tick, then verify no instruction modal appeared
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Activate routing")).toBeNull();
  });
});
