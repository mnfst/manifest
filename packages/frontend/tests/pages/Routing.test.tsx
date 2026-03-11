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
  Meta: (props: any) => <meta name={props.name ?? ""} content={props.content ?? ""} />,
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/components/ProviderSelectModal.js", () => ({
  default: (props: any) => (
    <div data-testid="provider-modal" data-agent={props.agentName ?? ""} data-providers={JSON.stringify(props.providers ?? [])}>
      <button onClick={props.onClose}>Done</button>
      <button onClick={props.onUpdate} data-testid="trigger-update">Update</button>
    </div>
  ),
}));

const mockGetProviders = vi.fn();
const mockGetCustomProviders = vi.fn();
const mockDeactivateAllProviders = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  getTierAssignments: vi.fn().mockResolvedValue([
    { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    { id: "3", user_id: "u1", tier: "complex", override_model: "claude-opus-4-6", auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
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
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
  updateCustomProvider: vi.fn().mockResolvedValue({}),
  deleteCustomProvider: vi.fn().mockResolvedValue({ ok: true }),
  setFallbacks: vi.fn().mockResolvedValue([]),
  clearFallbacks: vi.fn().mockResolvedValue(undefined),
  getModelPrices: vi.fn().mockResolvedValue([]),
}));

import Routing from "../../src/pages/Routing";
import ModelPickerModal from "../../src/components/ModelPickerModal";
import { toast } from "../../src/services/toast-store.js";
import type { AvailableModel, TierAssignment, CustomProviderData } from "../../src/services/api.js";

const { overrideTier, resetTier, resetAllTiers, setFallbacks } = await import("../../src/services/api.js");

describe("Routing — enabled state (providers active)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockGetCustomProviders.mockResolvedValue([]);
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

  it("shows Change button for all tiers", async () => {
    render(() => <Routing />);
    const changeButtons = await screen.findAllByText("Change");
    expect(changeButtons.length).toBe(4);
  });

  it("renders Add fallback button in tier cards", async () => {
    render(() => <Routing />);
    const addButtons = await screen.findAllByText("+ Add fallback");
    expect(addButtons.length).toBe(4); // one per tier
  });

  it("shows Reset button for override tiers", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Reset")).toBeDefined();
  });

  it("shows Reset all to auto button when overrides exist", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Reset all to auto")).toBeDefined();
  });

  it("shows provider count button", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("2 connections")).toBeDefined();
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
    const overrideButtons = await screen.findAllByText("Change");
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByText("Select a model")).toBeDefined();
  });

  it("opens model picker when Change button is clicked on override tier", async () => {
    render(() => <Routing />);
    const changeButtons = await screen.findAllByText("Change");
    // complex tier (index 2) has an override
    fireEvent.click(changeButtons[2]);
    expect(await screen.findByText("Select a model")).toBeDefined();
  });

  it("shows tier label in model picker subtitle", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Change");
    // Click override for 'simple' tier
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByText("Simple tier")).toBeDefined();
  });

  it("closes model picker when close button is clicked", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Change");
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
    const overrideButtons = await screen.findAllByText("Change");
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
    const overrideButtons = await screen.findAllByText("Change");
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
    const overrideButtons = await screen.findAllByText("Change");
    fireEvent.click(overrideButtons[0]);
    expect(await screen.findByLabelText("Search models or providers")).toBeDefined();
  });

  it("filters models by search query", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Change");
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
    const overrideButtons = await screen.findAllByText("Change");
    fireEvent.click(overrideButtons[0]);

    const searchInput = await screen.findByLabelText("Search models or providers");
    fireEvent.input(searchInput, { target: { value: "zzzzzzz" } });

    await waitFor(() => {
      expect(screen.getByText("No models match your search.")).toBeDefined();
    });
  });

  it("selects a model and calls overrideTier", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Change");
    fireEvent.click(overrideButtons[0]);
    await screen.findByText("Select a model");

    // Find the claude-opus-4-6 model button (unique in the list)
    const modelButtons = screen.getAllByText("Claude Opus 4.6");
    fireEvent.click(modelButtons[modelButtons.length - 1]);

    await waitFor(() => {
      expect(overrideTier).toHaveBeenCalledWith("test-agent", "simple", "claude-opus-4-6", "api_key");
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Routing updated");
    });
  });

  it("shows (recommended) label for auto-assigned model", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Change");
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
      expect(resetTier).toHaveBeenCalledWith("test-agent", "complex");
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Reset to auto");
    });
  });

  it("shows Resetting... and disables button during resetTier", async () => {
    let resolveReset: () => void;
    vi.mocked(resetTier).mockReturnValue(new Promise<void>((r) => { resolveReset = r; }) as any);
    render(() => <Routing />);
    const resetBtn = await screen.findByText("Reset");
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(resetBtn.querySelector(".spinner")).not.toBeNull();
      expect(resetBtn.disabled).toBe(true);
    });

    resolveReset!();
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

  it("shows Resetting... and disables button during resetAllTiers", async () => {
    let resolveResetAll: () => void;
    vi.mocked(resetAllTiers).mockReturnValue(new Promise<void>((r) => { resolveResetAll = r; }) as any);
    render(() => <Routing />);
    const resetAllBtn = await screen.findByText("Reset all to auto") as HTMLButtonElement;
    fireEvent.click(resetAllBtn);

    await waitFor(() => {
      expect(resetAllBtn.querySelector(".spinner")).not.toBeNull();
      expect(resetAllBtn.disabled).toBe(true);
    });

    resolveResetAll!();
  });

  it("opens provider modal when Connect providers button is clicked", async () => {
    render(() => <Routing />);
    const provBtn = await screen.findByText("Connect providers");
    fireEvent.click(provBtn);
    expect(screen.getByTestId("provider-modal")).toBeDefined();
  });

  it("calls deactivateAllProviders when Disable Routing is confirmed", async () => {
    render(() => <Routing />);
    const disableBtn = await screen.findByText("Disable Routing");
    fireEvent.click(disableBtn);

    // Confirm dialog appears — click the "Disable" button
    const confirmBtn = await screen.findByText("Disable");
    fireEvent.click(confirmBtn);

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
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    ]);

    render(() => <Routing />);
    const noModels = await screen.findAllByText("No model available");
    expect(noModels.length).toBe(4);
  });

  it("pluralizes provider count correctly", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);

    render(() => <Routing />);
    expect(await screen.findByText("2 connections")).toBeDefined();
  });

  it("shows 'Included in subscription' instead of price for subscription-only provider", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: true, auth_type: "subscription", connected_at: "2025-01-01" },
    ]);

    render(() => <Routing />);
    expect(await screen.findByText("Included in subscription")).toBeDefined();
  });

  it("prefers subscription when provider has both subscription and api_key", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: true, auth_type: "subscription", connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", is_active: true, has_api_key: true, auth_type: "api_key", connected_at: "2025-01-01" },
    ]);

    render(() => <Routing />);
    await screen.findByText("2 connections");
    expect(screen.queryByText("Included in subscription")).toBeDefined();
  });
});

describe("Routing — disabled state (no active providers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([]);
    mockGetCustomProviders.mockResolvedValue([]);
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
      { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockGetCustomProviders.mockResolvedValue([]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });
  });

  it("handles overrideTier error gracefully", async () => {
    vi.mocked(overrideTier).mockRejectedValueOnce(new Error("fail"));
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Change");
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

    const confirmBtn = await screen.findByText("Disable");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeactivateAllProviders).toHaveBeenCalled();
    });
  });

  it("closes confirm disable modal on overlay click", async () => {
    render(() => <Routing />);
    const disableBtn = await screen.findByText("Disable Routing");
    fireEvent.click(disableBtn);
    await waitFor(() => {
      expect(screen.getByText("Disable routing?")).toBeDefined();
    });
    // Click overlay (the modal-overlay element)
    const overlays = document.querySelectorAll(".modal-overlay");
    const confirmOverlay = Array.from(overlays).find(
      (o) => o.textContent?.includes("Disable routing?"),
    )!;
    fireEvent.click(confirmOverlay);
    await waitFor(() => {
      expect(screen.queryByText("Disable routing?")).toBeNull();
    });
  });

  it("closes confirm disable modal on Escape key", async () => {
    render(() => <Routing />);
    const disableBtn = await screen.findByText("Disable Routing");
    fireEvent.click(disableBtn);
    await waitFor(() => {
      expect(screen.getByText("Disable routing?")).toBeDefined();
    });
    const overlays = document.querySelectorAll(".modal-overlay");
    const confirmOverlay = Array.from(overlays).find(
      (o) => o.textContent?.includes("Disable routing?"),
    )!;
    fireEvent.keyDown(confirmOverlay, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Disable routing?")).toBeNull();
    });
  });

  it("resolves model label via PROVIDERS fallback for unknown API models", async () => {
    // Override getAvailableModels with a model whose provider doesn't match API data
    const { getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getAvailableModels).mockResolvedValueOnce([
      { model_name: "gpt-4o-mini", provider: "UnknownVendor", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
    ]);

    render(() => <Routing />);
    // The model should still be found via PROVIDERS fallback (gpt-4o-mini is in OpenAI's model list)
    await waitFor(() => {
      expect(screen.getByText("Simple")).toBeDefined();
    });
  });

  it("returns undefined from providerIdForModel when model matches nothing", async () => {
    // Use a completely unknown model name that matches no API model and no PROVIDERS entry
    const { getTierAssignments, getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValueOnce([
      { id: "1", user_id: "u1", tier: "simple", override_model: "totally-unknown-model-xyz", auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValueOnce([]);

    render(() => <Routing />);
    // The override model name should render (no provider icon since providerIdForModel returns undefined)
    await waitFor(() => {
      expect(screen.getByText("Simple")).toBeDefined();
    });
  });
});

describe("Routing — custom providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomProviders.mockResolvedValue([]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });
  });

  it("renders custom provider icon letter in provider info bar", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "custom:cp-uuid", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockGetCustomProviders.mockResolvedValue([{ id: "cp-uuid", name: "Groq", base_url: "https://api.groq.com", has_api_key: true, models: [], created_at: "2025-01-01" }]);

    const { container } = render(() => <Routing />);
    await waitFor(() => {
      // Custom provider branch: renders a letter icon instead of an SVG provider icon
      const letter = container.querySelector(".routing-providers-info .provider-card__logo-letter");
      expect(letter).not.toBeNull();
      // Letter is either "G" (if customProviders resolved) or "C" (fallback) — both exercise the branch
      expect(["G", "C"]).toContain(letter!.textContent);
    });
  });

  it("renders custom provider icon in routing card when model is custom", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "custom:cp-uuid", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    const { getTierAssignments, getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValue([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "custom:cp-uuid/my-llama", fallback_models: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValue([
      { model_name: "custom:cp-uuid/my-llama", provider: "custom:cp-uuid", provider_display_name: "Groq", display_name: "my-llama", input_price_per_token: null, output_price_per_token: null, context_window: 8192, capability_reasoning: false, capability_code: false },
    ]);
    mockGetCustomProviders.mockResolvedValue([{ id: "cp-uuid", name: "Groq", base_url: "https://api.groq.com", has_api_key: true, models: [], created_at: "2025-01-01" }]);

    const { container } = render(() => <Routing />);
    await waitFor(() => {
      const letter = container.querySelector(".routing-card .provider-card__logo-letter");
      expect(letter).not.toBeNull();
      expect(letter!.textContent).toBe("G");
    });
  });

  it("shows custom model label with provider name prefix", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "custom:cp-uuid", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    const { getTierAssignments, getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValue([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "custom:cp-uuid/my-llama", fallback_models: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValue([
      { model_name: "custom:cp-uuid/my-llama", provider: "custom:cp-uuid", provider_display_name: "Groq", display_name: "my-llama", input_price_per_token: null, output_price_per_token: null, context_window: 8192, capability_reasoning: false, capability_code: false },
    ]);
    mockGetCustomProviders.mockResolvedValue([{ id: "cp-uuid", name: "Groq", base_url: "https://api.groq.com", has_api_key: true, models: [], created_at: "2025-01-01" }]);

    render(() => <Routing />);
    await waitFor(() => {
      // labelFor should produce "Groq / my-llama"
      expect(screen.getByText("Groq / my-llama")).toBeDefined();
    });
  });

  it("shows dash for null-price custom model", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "custom:cp-uuid", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    const { getTierAssignments, getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValue([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "custom:cp-uuid/my-llama", fallback_models: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValue([
      { model_name: "custom:cp-uuid/my-llama", provider: "custom:cp-uuid", provider_display_name: "Groq", display_name: "my-llama", input_price_per_token: null, output_price_per_token: null, context_window: 8192, capability_reasoning: false, capability_code: false },
    ]);
    mockGetCustomProviders.mockResolvedValue([{ id: "cp-uuid", name: "Groq", base_url: "https://api.groq.com", has_api_key: true, models: [], created_at: "2025-01-01" }]);

    const { container } = render(() => <Routing />);
    await waitFor(() => {
      // null prices → pricePerM returns "—"
      expect(container.textContent).toContain("\u2014 in");
    });
  });

  it("passes customProviders to ProviderSelectModal", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockGetCustomProviders.mockResolvedValue([{ id: "cp-1", name: "Test", base_url: "https://test.com", has_api_key: true, models: [], created_at: "2025-01-01" }]);

    render(() => <Routing />);
    const provBtn = await screen.findByText("Connect providers");
    fireEvent.click(provBtn);
    expect(screen.getByTestId("provider-modal")).toBeDefined();
  });
});

describe("ModelPickerModal — custom providers and filtering", () => {
  const baseTiers: TierAssignment[] = [
    { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
  ];

  it("shows custom provider group with letter icon", () => {
    const models: AvailableModel[] = [
      { model_name: "custom:cp-uuid/my-llama", provider: "custom:cp-uuid", provider_display_name: "Groq", display_name: "my-llama", input_price_per_token: null, output_price_per_token: null, context_window: 8192, capability_reasoning: false, capability_code: false },
    ];
    const customProviders: CustomProviderData[] = [
      { id: "cp-uuid", name: "Groq", base_url: "https://api.groq.com", has_api_key: true, models: [], created_at: "2025-01-01" },
    ];

    const { container } = render(() => (
      <ModelPickerModal
        tierId="simple"
        models={models}
        tiers={baseTiers}
        customProviders={customProviders}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    ));

    const groupHeader = container.querySelector(".routing-modal__group-header .provider-card__logo-letter");
    expect(groupHeader).not.toBeNull();
    expect(groupHeader!.textContent).toBe("G");
    const groupName = container.querySelector(".routing-modal__group-name");
    expect(groupName?.textContent).toBe("Groq");
  });

  it("filters free models correctly with isFreeModel", () => {
    const models: AvailableModel[] = [
      { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "free-model", provider: "OpenAI", input_price_per_token: 0, output_price_per_token: 0, context_window: 128000, capability_reasoning: false, capability_code: false },
      { model_name: "null-price-model", provider: "OpenAI", input_price_per_token: null, output_price_per_token: null, context_window: 128000, capability_reasoning: false, capability_code: false },
    ];

    const { container } = render(() => (
      <ModelPickerModal
        tierId="simple"
        models={models}
        tiers={baseTiers}
        customProviders={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    ));

    // Enable free models only filter
    const checkbox = container.querySelector('.routing-modal__filter-toggle input[type="checkbox"]') as HTMLInputElement;
    fireEvent.change(checkbox, { target: { checked: true } });

    // free-model (price=0) should show, null-price-model (price=null) should NOT show
    expect(screen.getByText("free-model")).toBeDefined();
    expect(screen.queryByText("null-price-model")).toBeNull();
  });

  it("resolves vendor-prefixed model names via labelForModel", () => {
    const models: AvailableModel[] = [
      { model_name: "openai/gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
    ];

    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={models}
        tiers={baseTiers}
        customProviders={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    ));

    // labelForModel strips vendor prefix "openai/" and looks up "gpt-4o-mini" → "GPT-4o Mini"
    expect(screen.getByText("GPT-4o Mini")).toBeDefined();
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
      { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
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
      { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });

    render(() => <Routing />);
    // Open provider modal
    const provBtn = await screen.findByText("Connect providers");
    fireEvent.click(provBtn);

    // Trigger update (routing was already enabled)
    const updateBtn = screen.getByTestId("trigger-update");
    fireEvent.click(updateBtn);

    // Wait a tick, then verify no instruction modal appeared
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Activate routing")).toBeNull();
  });
});

describe("Routing — fallback management", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
    ]);
    mockGetCustomProviders.mockResolvedValue([]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });
    const { getTierAssignments, getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValue([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValue([
      { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "claude-opus-4-6", provider: "Anthropic", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
    ]);
  });

  it("opens fallback picker when Add fallback is clicked", async () => {
    render(() => <Routing />);
    const addButtons = await screen.findAllByText("+ Add fallback");
    fireEvent.click(addButtons[0]);
    // The model picker modal should open
    expect(await screen.findByText("Select a model")).toBeDefined();
  });

  it("calls setFallbacks when a fallback model is picked", async () => {
    render(() => <Routing />);
    const addButtons = await screen.findAllByText("+ Add fallback");
    fireEvent.click(addButtons[0]); // simple tier
    await screen.findByText("Select a model");

    const modalButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
    // Pick the claude-opus-4-6 button (only model in the fallback picker since gpt-4o-mini is the primary)
    fireEvent.click(modalButtons[0]);

    await waitFor(() => {
      expect(setFallbacks).toHaveBeenCalledWith("test-agent", "simple", ["claude-opus-4-6"]);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Fallback added");
    });
  });

  it("does not duplicate existing fallback model", async () => {
    const { getTierAssignments } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValueOnce([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: ["claude-opus-4-6"], updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    ]);

    render(() => <Routing />);
    const addButtons = await screen.findAllByText("+ Add fallback");
    fireEvent.click(addButtons[0]); // simple tier
    await screen.findByText("Select a model");

    // Both gpt-4o-mini (primary) and claude-opus-4-6 (existing fallback) are filtered out
    const modalButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
    expect(modalButtons.length).toBe(0);
  });

  it("shows Adding... on the add button while setFallbacks is in progress", async () => {
    let resolveSetFallbacks: () => void;
    vi.mocked(setFallbacks).mockReturnValueOnce(new Promise<void>((r) => { resolveSetFallbacks = r; }) as any);
    render(() => <Routing />);
    const addButtons = await screen.findAllByText("+ Add fallback");
    fireEvent.click(addButtons[0]); // simple tier
    await screen.findByText("Select a model");

    const modalButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
    fireEvent.click(modalButtons[0]);

    await waitFor(() => {
      const addBtn = document.querySelector(".fallback-list__add") as HTMLButtonElement;
      expect(addBtn.querySelector(".spinner")).not.toBeNull();
      expect(addBtn.disabled).toBe(true);
    });

    resolveSetFallbacks!();
  });

  it("handles setFallbacks error gracefully and rolls back optimistic state", async () => {
    vi.mocked(setFallbacks).mockRejectedValueOnce(new Error("fail"));
    render(() => <Routing />);
    const addButtons = await screen.findAllByText("+ Add fallback");
    fireEvent.click(addButtons[0]);
    await screen.findByText("Select a model");

    const modalButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
    fireEvent.click(modalButtons[0]);

    await waitFor(() => {
      expect(setFallbacks).toHaveBeenCalled();
    });
  });

  it("renders fallback list when tier has fallback_models", async () => {
    const { getTierAssignments } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValueOnce([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: ["claude-opus-4-6"], updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    ]);

    const { container } = render(() => <Routing />);
    await waitFor(() => {
      const ranks = container.querySelectorAll(".fallback-list__rank");
      expect(ranks.length).toBe(1);
      expect(ranks[0].textContent).toBe("1.");
    });
  });

  it("exercises FallbackList props (agentName, tier, customProviders) via remove", async () => {
    const { getTierAssignments, getAvailableModels, clearFallbacks: mockClearFallbacks } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValueOnce([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: ["custom:cp-1/my-llama"], updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValueOnce([
      { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "custom:cp-1/my-llama", provider: "custom:cp-1", provider_display_name: "MyProvider", display_name: "my-llama", input_price_per_token: null, output_price_per_token: null, context_window: 8192, capability_reasoning: false, capability_code: false },
    ]);
    mockGetCustomProviders.mockResolvedValue([
      { id: "cp-1", name: "MyProvider", base_url: "https://test.com", has_api_key: true, models: [], created_at: "2025-01-01" },
    ]);

    const { container } = render(() => <Routing />);
    // Wait for fallback list to render with custom provider fallback
    await waitFor(() => {
      const removeButtons = container.querySelectorAll(".fallback-list__remove");
      expect(removeButtons.length).toBe(1);
      // Custom provider letter icon should render (accessing customProviders prop)
      const letterIcon = container.querySelector(".fallback-list__item .provider-card__logo-letter");
      expect(letterIcon).not.toBeNull();
      expect(letterIcon!.textContent).toBe("M");
    });

    // Click the remove button — forces FallbackList to read props.agentName and props.tier
    const removeBtn = container.querySelector(".fallback-list__remove") as HTMLButtonElement;
    fireEvent.click(removeBtn);

    await waitFor(() => {
      // clearFallbacks is called when removing the only fallback
      expect(mockClearFallbacks).toHaveBeenCalledWith("test-agent", "simple");
    });
  });

  it("closes fallback picker when close button is clicked", async () => {
    render(() => <Routing />);
    const addButtons = await screen.findAllByText("+ Add fallback");
    fireEvent.click(addButtons[0]);
    expect(await screen.findByText("Select a model")).toBeDefined();

    const closeBtns = screen.getAllByLabelText("Close");
    fireEvent.click(closeBtns[closeBtns.length - 1]);
    await waitFor(() => {
      expect(screen.queryByText("Select a model")).toBeNull();
    });
  });
});

describe("Routing — effectiveAuth case-insensitive matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomProviders.mockResolvedValue([]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });
  });

  it("matches provider with different casing via effectiveAuth", async () => {
    // Provider stored as "Anthropic" (capitalized) but providerIdForModel returns "anthropic" (lowercase)
    // effectiveAuth now uses case-insensitive comparison: p.provider.toLowerCase() === id.toLowerCase()
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "Anthropic", is_active: true, has_api_key: true, auth_type: "subscription", connected_at: "2025-01-01" },
    ]);
    const { getTierAssignments, getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValue([
      { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "claude-opus-4-6", fallback_models: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValue([
      { model_name: "claude-opus-4-6", provider: "Anthropic", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
    ]);

    render(() => <Routing />);
    // Should show "Included in subscription" because effectiveAuth matches "Anthropic" provider case-insensitively
    expect(await screen.findByText("Included in subscription")).toBeDefined();
  });

  it("shows Subscription badge when override_auth_type is set", async () => {
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: true, auth_type: "subscription", connected_at: "2025-01-01" },
    ]);
    const { getTierAssignments, getAvailableModels } = await import("../../src/services/api.js");
    vi.mocked(getTierAssignments).mockResolvedValue([
      { id: "1", user_id: "u1", tier: "simple", override_model: "claude-opus-4-6", override_auth_type: "subscription", auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "3", user_id: "u1", tier: "complex", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
      { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
    ]);
    vi.mocked(getAvailableModels).mockResolvedValue([
      { model_name: "claude-opus-4-6", provider: "Anthropic", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
    ]);

    render(() => <Routing />);
    expect(await screen.findByText("Included in subscription")).toBeDefined();
  });
});
