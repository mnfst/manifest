import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

vi.mock("../../src/components/ProviderSelectModal.js", () => ({
  default: (props: any) => (
    <div data-testid="provider-modal">
      <button onClick={props.onClose}>Done</button>
    </div>
  ),
}));

vi.mock("../../src/services/api.js", () => ({
  getModelPrices: vi.fn().mockResolvedValue({ models: [], lastSyncedAt: null }),
  getAgentKey: vi.fn().mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: "mnfst_abc123" }),
  getHealth: vi.fn().mockResolvedValue({ mode: "cloud" }),
}));

import RoutingModals from "../../src/components/RoutingModals";
import type { TierAssignment, AvailableModel, CustomProviderData, RoutingProvider } from "../../src/services/api.js";

const baseTiers: TierAssignment[] = [
  { id: "1", user_id: "u1", tier: "simple", override_model: null, override_provider: null, auto_assigned_model: "gpt-4o-mini", fallback_models: null, updated_at: "2025-01-01" },
  { id: "2", user_id: "u1", tier: "standard", override_model: null, override_provider: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
  { id: "3", user_id: "u1", tier: "complex", override_model: null, override_provider: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
  { id: "4", user_id: "u1", tier: "reasoning", override_model: null, override_provider: null, auto_assigned_model: null, fallback_models: null, updated_at: "2025-01-01" },
];

const baseModels: AvailableModel[] = [
  { model_name: "gpt-4o-mini", provider: "OpenAI", display_name: "GPT-4o Mini", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
  { model_name: "claude-opus-4-6", provider: "Anthropic", display_name: "Claude Opus 4.6", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
];

const baseProviders: RoutingProvider[] = [
  { id: "p1", provider: "openai", auth_type: "api_key" as const, is_active: true, has_api_key: true, connected_at: "2025-01-01" },
];

describe("RoutingModals", () => {
  const defaultProps = () => {
    const [dropdownTier] = createSignal<string | null>(null);
    const [specificityDropdown] = createSignal<string | null>(null);
    const [fallbackPickerTier] = createSignal<string | null>(null);
    const [showProviderModal] = createSignal(false);
    const [instructionModal] = createSignal<"enable" | "disable" | null>(null);
    const [instructionProvider] = createSignal<string | null>(null);
    const [confirmDisable] = createSignal(false);
    const [disabling] = createSignal(false);

    return {
      agentName: () => "test-agent",
      dropdownTier,
      onDropdownClose: vi.fn(),
      specificityDropdown,
      onSpecificityDropdownClose: vi.fn(),
      onSpecificityOverride: vi.fn(),
      fallbackPickerTier,
      onFallbackPickerClose: vi.fn(),
      showProviderModal,
      onProviderModalClose: vi.fn(),
      instructionModal,
      instructionProvider,
      onInstructionClose: vi.fn(),
      confirmDisable,
      disabling,
      onDisableCancel: vi.fn(),
      onDisableConfirm: vi.fn().mockResolvedValue(undefined),
      models: () => baseModels,
      tiers: () => baseTiers,
      customProviders: () => [] as CustomProviderData[],
      connectedProviders: () => baseProviders,
      getTier: (tierId: string) => baseTiers.find((t) => t.tier === tierId),
      onOverride: vi.fn(),
      onAddFallback: vi.fn(),
      onProviderUpdate: vi.fn().mockResolvedValue(undefined),
    };
  };

  it("renders specificity dropdown modal when specificityDropdown is set", () => {
    const [specificityDropdown] = createSignal<string | null>("coding");
    const onSpecificityOverride = vi.fn();
    const onSpecificityDropdownClose = vi.fn();

    render(() => (
      <RoutingModals
        {...defaultProps()}
        specificityDropdown={specificityDropdown}
        onSpecificityDropdownClose={onSpecificityDropdownClose}
        onSpecificityOverride={onSpecificityOverride}
      />
    ));

    // The specificity dropdown opens a ModelPickerModal
    expect(screen.getByText("Select a model")).toBeDefined();
  });

  it("does not render specificity dropdown modal when specificityDropdown is null", () => {
    const [specificityDropdown] = createSignal<string | null>(null);

    render(() => (
      <RoutingModals
        {...defaultProps()}
        specificityDropdown={specificityDropdown}
      />
    ));

    // No model picker should be open
    expect(screen.queryByText("Select a model")).toBeNull();
  });

  it("onSpecificityOverride callback is called with correct args when model is selected", async () => {
    const [specificityDropdown] = createSignal<string | null>("coding");
    const onSpecificityOverride = vi.fn();

    render(() => (
      <RoutingModals
        {...defaultProps()}
        specificityDropdown={specificityDropdown}
        onSpecificityOverride={onSpecificityOverride}
      />
    ));

    await screen.findByText("Select a model");

    // Click on a model in the picker
    const modelButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
    expect(modelButtons.length).toBeGreaterThan(0);
    fireEvent.click(modelButtons[0]);

    await waitFor(() => {
      expect(onSpecificityOverride).toHaveBeenCalled();
      // First argument should be the category "coding"
      expect(onSpecificityOverride.mock.calls[0][0]).toBe("coding");
      // Second argument should be the model name
      expect(typeof onSpecificityOverride.mock.calls[0][1]).toBe("string");
      // Third argument should be the provider
      expect(typeof onSpecificityOverride.mock.calls[0][2]).toBe("string");
    });
  });

  it("calls onSpecificityDropdownClose when specificity modal close is clicked", async () => {
    const [specificityDropdown] = createSignal<string | null>("coding");
    const onSpecificityDropdownClose = vi.fn();

    render(() => (
      <RoutingModals
        {...defaultProps()}
        specificityDropdown={specificityDropdown}
        onSpecificityDropdownClose={onSpecificityDropdownClose}
      />
    ));

    await screen.findByText("Select a model");

    // Close the modal
    const closeBtns = screen.getAllByLabelText("Close");
    fireEvent.click(closeBtns[closeBtns.length - 1]);

    expect(onSpecificityDropdownClose).toHaveBeenCalled();
  });

  describe("multi-key KeyPickerModal interception", () => {
    const twoOpenAiKeys: RoutingProvider[] = [
      {
        id: "k1",
        provider: "openai",
        auth_type: "api_key" as const,
        is_active: true,
        has_api_key: true,
        label: "Personal",
        priority: 0,
        connected_at: "2026-04-27",
      } as RoutingProvider,
      {
        id: "k2",
        provider: "openai",
        auth_type: "api_key" as const,
        is_active: true,
        has_api_key: true,
        label: "Work",
        priority: 1,
        connected_at: "2026-04-27",
      } as RoutingProvider,
    ];

    it("forwards directly to onOverride when only one key exists for the resolved provider", async () => {
      const [dropdownTier] = createSignal<string | null>("simple");
      const onOverride = vi.fn();

      render(() => (
        <RoutingModals
          {...defaultProps()}
          dropdownTier={dropdownTier}
          connectedProviders={() => baseProviders}
          onOverride={onOverride}
        />
      ));

      await screen.findByText("Select a model");
      const modelButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
      fireEvent.click(modelButtons[0]);

      await waitFor(() => {
        expect(onOverride).toHaveBeenCalled();
      });
      // No KeyPickerModal opened — passes through directly with no label.
      expect(screen.queryByText(/Which OpenAI key/i)).toBeNull();
    });

    it("opens the KeyPickerModal when 2+ keys exist for the resolved provider", async () => {
      const [dropdownTier] = createSignal<string | null>("simple");
      const onOverride = vi.fn();

      render(() => (
        <RoutingModals
          {...defaultProps()}
          dropdownTier={dropdownTier}
          connectedProviders={() => twoOpenAiKeys}
          onOverride={onOverride}
        />
      ));

      await screen.findByText("Select a model");
      const modelButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
      fireEvent.click(modelButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Which OpenAI key/i)).toBeDefined();
      });
      // onOverride should NOT have been called yet — waiting on key pick.
      expect(onOverride).not.toHaveBeenCalled();
    });

    it("forwards to onOverride with the chosen label after key pick", async () => {
      const [dropdownTier] = createSignal<string | null>("simple");
      const onOverride = vi.fn();

      render(() => (
        <RoutingModals
          {...defaultProps()}
          dropdownTier={dropdownTier}
          connectedProviders={() => twoOpenAiKeys}
          onOverride={onOverride}
        />
      ));

      await screen.findByText("Select a model");
      fireEvent.click(document.querySelectorAll<HTMLButtonElement>(".routing-modal__model")[0]);
      await screen.findByText(/Which OpenAI key/i);

      fireEvent.click(screen.getByText("Work"));

      await waitFor(() => {
        expect(onOverride).toHaveBeenCalled();
      });
      // 5th arg = label
      expect(onOverride.mock.calls[0][4]).toBe("Work");
    });

    it("resolves the custom-provider display name in the KeyPickerModal title", async () => {
      const [dropdownTier] = createSignal<string | null>("simple");
      const customProviders: CustomProviderData[] = [
        { id: "abc", name: "Together", base_url: "https://api.together.ai", api_kind: "openai", has_api_key: true, models: [], created_at: "2026-04-27" } as CustomProviderData,
      ];
      const customKeys: RoutingProvider[] = [
        { id: "ck1", provider: "custom:abc", auth_type: "api_key", is_active: true, has_api_key: true, label: "Personal", priority: 0, connected_at: "2026-04-27" } as RoutingProvider,
        { id: "ck2", provider: "custom:abc", auth_type: "api_key", is_active: true, has_api_key: true, label: "Work", priority: 1, connected_at: "2026-04-27" } as RoutingProvider,
      ];
      const customModels: AvailableModel[] = [
        { model_name: "custom:abc/llama", provider: "custom:abc", display_name: "Llama 70B", input_price_per_token: 0, output_price_per_token: 0, context_window: 8192, capability_reasoning: false, capability_code: true } as AvailableModel,
      ];

      render(() => (
        <RoutingModals
          {...defaultProps()}
          dropdownTier={dropdownTier}
          models={() => customModels}
          customProviders={() => customProviders}
          connectedProviders={() => customKeys}
        />
      ));

      await screen.findByText("Select a model");
      fireEvent.click(document.querySelectorAll<HTMLButtonElement>(".routing-modal__model")[0]);

      // The "Which Together key?" title resolves the custom provider's
      // friendly name from `customProviders`, not the `custom:abc` id.
      await screen.findByText(/Which Together key/i);
    });

    it("closes the KeyPickerModal without calling onOverride when × is clicked", async () => {
      const [dropdownTier] = createSignal<string | null>("simple");
      const onOverride = vi.fn();

      render(() => (
        <RoutingModals
          {...defaultProps()}
          dropdownTier={dropdownTier}
          connectedProviders={() => twoOpenAiKeys}
          onOverride={onOverride}
        />
      ));

      await screen.findByText("Select a model");
      fireEvent.click(document.querySelectorAll<HTMLButtonElement>(".routing-modal__model")[0]);
      await screen.findByText(/Which OpenAI key/i);

      // Find the close button on the key picker modal (last × button on screen).
      const closeBtns = screen.getAllByLabelText("Close");
      fireEvent.click(closeBtns[closeBtns.length - 1]);

      await waitFor(() => {
        expect(screen.queryByText(/Which OpenAI key/i)).toBeNull();
      });
      expect(onOverride).not.toHaveBeenCalled();
    });
  });

  it("fallback picker uses getTier to resolve specificity assignment fallbacks", () => {
    const specificityAssignment = {
      ...baseTiers[0],
      tier: "coding",
      category: "coding",
      auto_assigned_model: "claude-opus-4-6",
      override_model: null,
      fallback_models: ["gpt-4o-mini"],
    };

    const [fallbackPickerTier] = createSignal<string | null>("coding");

    render(() => (
      <RoutingModals
        {...defaultProps()}
        fallbackPickerTier={fallbackPickerTier}
        getTier={(tierId: string) => {
          if (tierId === "coding") return specificityAssignment as any;
          return baseTiers.find((t) => t.tier === tierId);
        }}
      />
    ));

    // The model picker for fallback should open
    expect(screen.getByText("Select a model")).toBeDefined();

    // Models should be filtered: claude-opus-4-6 (primary) and gpt-4o-mini (existing fallback) excluded
    const modalButtons = document.querySelectorAll<HTMLButtonElement>(".routing-modal__model");
    expect(modalButtons.length).toBe(0);
  });
});
