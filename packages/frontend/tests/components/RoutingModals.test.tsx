import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

// Capture all ModelPickerModal renders so the test can assert which models /
// tiers got passed through.
const pickerCalls: Array<Record<string, unknown>> = [];

vi.mock("../../src/components/ModelPickerModal.js", () => ({
  default: (props: Record<string, unknown>) => {
    pickerCalls.push({
      tierId: props.tierId,
      modelsCount: (props.models as { length: number } | undefined)?.length ?? 0,
      modelsList: ((props.models as { model_name: string }[] | undefined) ?? []).map(
        (m) => `${m.model_name}:${(m as { auth_type?: string }).auth_type ?? ""}`,
      ),
      tiersCount: (props.tiers as { length: number } | undefined)?.length ?? 0,
    });
    return (
      <div
        data-testid={`picker-${props.tierId}`}
        onClick={() =>
          (props.onSelect as (id: string, m: string, p: string, a?: string) => void)(
            props.tierId as string,
            "gpt-4o",
            "openai",
            "api_key",
          )
        }
      >
        picker
        <button
          data-testid={`picker-close-${props.tierId}`}
          onClick={() => (props.onClose as () => void)()}
        >
          close
        </button>
        <button
          data-testid={`picker-connect-${props.tierId}`}
          onClick={() => (props.onConnectProviders as () => void)?.()}
        >
          connect
        </button>
      </div>
    );
  },
}));

const psmProps: Array<Record<string, unknown>> = [];
vi.mock("../../src/components/ProviderSelectModal.js", () => ({
  default: (props: Record<string, unknown>) => {
    psmProps.push({
      agentName: props.agentName,
      providersCount: (props.providers as { length: number })?.length ?? 0,
      customProvidersCount: (props.customProviders as { length: number })?.length ?? 0,
    });
    return (
      <div data-testid="provider-select-modal">
        <button
          data-testid="psm-close"
          onClick={() => (props.onClose as () => void)()}
        >
          close
        </button>
        <button
          data-testid="psm-update"
          onClick={() => (props.onUpdate as () => Promise<void>)?.()}
        >
          update
        </button>
      </div>
    );
  },
}));

const riProps: Array<Record<string, unknown>> = [];
vi.mock("../../src/components/RoutingInstructionModal.js", () => ({
  default: (props: Record<string, unknown>) => {
    riProps.push({
      open: props.open,
      mode: props.mode,
      agentName: props.agentName,
      connectedProvider: props.connectedProvider,
    });
    return (
      <div
        data-testid={`instruction-modal-${(props.open as boolean) ? "open" : "closed"}-${props.mode as string}`}
      >
        <button data-testid="ri-close" onClick={() => (props.onClose as () => void)()}>
          close
        </button>
      </div>
    );
  },
}));

import RoutingModals from "../../src/components/RoutingModals";
import type {
  TierAssignment,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
  SpecificityAssignment,
} from "../../src/services/api";

const sampleModels: AvailableModel[] = [
  {
    model_name: "gpt-4o",
    provider: "openai",
    auth_type: "api_key",
    input_price_per_token: 0,
    output_price_per_token: 0,
    context_window: 0,
    capability_reasoning: false,
    capability_code: false,
    quality_score: 0,
  },
  {
    model_name: "gpt-4o",
    provider: "openai",
    auth_type: "subscription",
    input_price_per_token: 0,
    output_price_per_token: 0,
    context_window: 0,
    capability_reasoning: false,
    capability_code: false,
    quality_score: 0,
  },
  {
    model_name: "claude-opus",
    provider: "anthropic",
    auth_type: "api_key",
    input_price_per_token: 0,
    output_price_per_token: 0,
    context_window: 0,
    capability_reasoning: false,
    capability_code: false,
    quality_score: 0,
  },
];

const tiers: TierAssignment[] = [
  {
    id: "t1",
    agent_id: "a",
    tier: "simple",
    override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
    auto_assigned_route: null,
    fallback_routes: [
      { provider: "anthropic", authType: "api_key", model: "claude-opus" },
    ],
    updated_at: "2025-01-01",
  },
];

const specificityAssignments: SpecificityAssignment[] = [
  {
    id: "s1",
    agent_id: "a",
    category: "coding",
    is_active: true,
    override_route: null,
    auto_assigned_route: null,
    fallback_routes: null,
    updated_at: "2025-01-01",
  },
  {
    id: "s2",
    agent_id: "a",
    category: "trading",
    is_active: false,
    override_route: null,
    auto_assigned_route: null,
    fallback_routes: null,
    updated_at: "2025-01-01",
  },
];

const baseProps = {
  agentName: () => "demo",
  onDropdownClose: vi.fn(),
  onSpecificityDropdownClose: vi.fn(),
  onSpecificityOverride: vi.fn(),
  onFallbackPickerClose: vi.fn(),
  onProviderModalClose: vi.fn(),
  onInstructionClose: vi.fn(),
  onProviderUpdate: vi.fn().mockResolvedValue(undefined),
  onOpenProviderModal: vi.fn(),
  models: () => sampleModels,
  tiers: () => tiers,
  specificityAssignments: () => specificityAssignments,
  customProviders: () => [] as CustomProviderData[],
  connectedProviders: () => [] as RoutingProvider[],
  getTier: (id: string) => tiers.find((t) => t.tier === id),
  onOverride: vi.fn(),
  onAddFallback: vi.fn(),
};

function makeProps(overrides: Partial<Parameters<typeof RoutingModals>[0]> = {}) {
  return {
    ...baseProps,
    dropdownTier: () => null,
    specificityDropdown: () => null,
    fallbackPickerTier: () => null,
    showProviderModal: () => false,
    instructionModal: () => null,
    instructionProvider: () => null,
    ...overrides,
  } as Parameters<typeof RoutingModals>[0];
}

describe("RoutingModals", () => {
  beforeEach(() => {
    pickerCalls.length = 0;
    psmProps.length = 0;
    riProps.length = 0;
    vi.clearAllMocks();
  });

  it("renders the dropdown picker when dropdownTier is set", () => {
    const { queryByTestId } = render(() => (
      <RoutingModals {...makeProps({ dropdownTier: () => "simple" })} />
    ));
    expect(queryByTestId("picker-simple")).not.toBeNull();
  });

  it("forwards onDropdownClose when picker closes", () => {
    const onDropdownClose = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals {...makeProps({ dropdownTier: () => "simple", onDropdownClose })} />
    ));
    fireEvent.click(getByTestId("picker-close-simple"));
    expect(onDropdownClose).toHaveBeenCalled();
  });

  it("calls onOverride when picker selects a model", () => {
    const onOverride = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals {...makeProps({ dropdownTier: () => "simple", onOverride })} />
    ));
    fireEvent.click(getByTestId("picker-simple"));
    expect(onOverride).toHaveBeenCalledWith("simple", "gpt-4o", "openai", "api_key");
  });

  it("opens specificity picker only filtered to active assignments", () => {
    render(() => (
      <RoutingModals {...makeProps({ specificityDropdown: () => "coding" })} />
    ));
    // 1 active assignment → tiersCount === 1
    expect(pickerCalls[0].tiersCount).toBe(1);
  });

  it("invokes onSpecificityOverride with the category, model, provider, and authType", () => {
    const onSpecificityOverride = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals
        {...makeProps({ specificityDropdown: () => "coding", onSpecificityOverride })}
      />
    ));
    fireEvent.click(getByTestId("picker-coding"));
    expect(onSpecificityOverride).toHaveBeenCalledWith("coding", "gpt-4o", "openai", "api_key");
  });

  describe("fallback picker filtering", () => {
    it("filters out the primary route entry by full (model, provider, authType)", () => {
      render(() => (
        <RoutingModals {...makeProps({ fallbackPickerTier: () => "simple" })} />
      ));
      // 3 sample models. Primary is gpt-4o on openai/api_key — that one filtered.
      // Already-fallback claude-opus on anthropic/api_key — that one filtered.
      // gpt-4o on openai/subscription should remain (different auth tuple).
      const list = pickerCalls[0].modelsList as string[];
      expect(list).toEqual(["gpt-4o:subscription"]);
    });

    it("does NOT dedupe same model name on different authType", () => {
      // The primary route is api_key. The subscription variant must remain.
      render(() => (
        <RoutingModals {...makeProps({ fallbackPickerTier: () => "simple" })} />
      ));
      const list = pickerCalls[0].modelsList as string[];
      expect(list).toContain("gpt-4o:subscription");
    });

    it("treats no-auth-type model rows as non-primary and non-fallback (kept in list)", () => {
      const noAuthModels: AvailableModel[] = [
        {
          model_name: "anonymous-model",
          provider: "openai",
          input_price_per_token: 0,
          output_price_per_token: 0,
          context_window: 0,
          capability_reasoning: false,
          capability_code: false,
          quality_score: 0,
        },
      ];
      render(() => (
        <RoutingModals
          {...makeProps({
            fallbackPickerTier: () => "simple",
            models: () => noAuthModels,
          })}
        />
      ));
      expect((pickerCalls[0].modelsList as string[])[0]).toBe("anonymous-model:");
    });
  });

  it("does not render ProviderSelectModal when showProviderModal is false", () => {
    const { queryByTestId } = render(() => (
      <RoutingModals {...makeProps({ showProviderModal: () => false })} />
    ));
    expect(queryByTestId("provider-select-modal")).toBeNull();
  });

  it("renders ProviderSelectModal when showProviderModal is true", () => {
    const { queryByTestId } = render(() => (
      <RoutingModals {...makeProps({ showProviderModal: () => true })} />
    ));
    expect(queryByTestId("provider-select-modal")).not.toBeNull();
  });

  it("renders the instruction modal in the open state when instructionModal returns 'enable'", () => {
    const { getByTestId } = render(() => (
      <RoutingModals {...makeProps({ instructionModal: () => "enable" })} />
    ));
    expect(getByTestId("instruction-modal-open-enable")).not.toBeNull();
  });

  it("renders the instruction modal in the closed state when instructionModal returns null", () => {
    const { queryByTestId } = render(() => (
      <RoutingModals {...makeProps({ instructionModal: () => null })} />
    ));
    expect(queryByTestId("instruction-modal-closed-enable")).not.toBeNull();
  });

  it("forwards onConnectProviders from the dropdown picker through to onOpenProviderModal", () => {
    const onOpenProviderModal = vi.fn();
    const onDropdownClose = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals
        {...makeProps({
          dropdownTier: () => "simple",
          onOpenProviderModal,
          onDropdownClose,
        })}
      />
    ));
    fireEvent.click(getByTestId("picker-connect-simple"));
    expect(onDropdownClose).toHaveBeenCalled();
    expect(onOpenProviderModal).toHaveBeenCalled();
  });

  it("forwards onConnectProviders from the fallback picker through to onOpenProviderModal", () => {
    const onOpenProviderModal = vi.fn();
    const onFallbackPickerClose = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals
        {...makeProps({
          fallbackPickerTier: () => "simple",
          onOpenProviderModal,
          onFallbackPickerClose,
        })}
      />
    ));
    fireEvent.click(getByTestId("picker-connect-simple"));
    expect(onFallbackPickerClose).toHaveBeenCalled();
    expect(onOpenProviderModal).toHaveBeenCalled();
  });

  it("forwards onConnectProviders from the specificity picker through to onOpenProviderModal", () => {
    const onOpenProviderModal = vi.fn();
    const onSpecificityDropdownClose = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals
        {...makeProps({
          specificityDropdown: () => "coding",
          onOpenProviderModal,
          onSpecificityDropdownClose,
        })}
      />
    ));
    fireEvent.click(getByTestId("picker-connect-coding"));
    expect(onSpecificityDropdownClose).toHaveBeenCalled();
    expect(onOpenProviderModal).toHaveBeenCalled();
  });

  it("calls onAddFallback when fallback picker selects a model", () => {
    const onAddFallback = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals {...makeProps({ fallbackPickerTier: () => "simple", onAddFallback })} />
    ));
    fireEvent.click(getByTestId("picker-simple"));
    expect(onAddFallback).toHaveBeenCalledWith("simple", "gpt-4o", "openai", "api_key");
  });

  it("forwards agentName, providers, and customProviders into ProviderSelectModal", () => {
    render(() => (
      <RoutingModals {...makeProps({ showProviderModal: () => true })} />
    ));
    expect(psmProps.length).toBeGreaterThan(0);
    const last = psmProps[psmProps.length - 1];
    expect(last.agentName).toBe("demo");
    // baseProps has empty arrays for both
    expect(last.providersCount).toBe(0);
    expect(last.customProvidersCount).toBe(0);
  });

  it("forwards onClose and onUpdate from ProviderSelectModal to handlers", () => {
    const onProviderModalClose = vi.fn();
    const onProviderUpdate = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(() => (
      <RoutingModals
        {...makeProps({
          showProviderModal: () => true,
          onProviderModalClose,
          onProviderUpdate,
        })}
      />
    ));
    fireEvent.click(getByTestId("psm-close"));
    expect(onProviderModalClose).toHaveBeenCalled();
    fireEvent.click(getByTestId("psm-update"));
    expect(onProviderUpdate).toHaveBeenCalled();
  });

  it("renders RoutingInstructionModal with the provider name from the accessor", () => {
    render(() => (
      <RoutingModals
        {...makeProps({
          instructionModal: () => "disable",
          instructionProvider: () => "openai",
        })}
      />
    ));
    const last = riProps[riProps.length - 1];
    expect(last.open).toBe(true);
    expect(last.mode).toBe("disable");
    expect(last.connectedProvider).toBe("openai");
  });

  it("falls back to mode='enable' when instructionModal returns null", () => {
    render(() => <RoutingModals {...makeProps({ instructionModal: () => null })} />);
    const last = riProps[riProps.length - 1];
    expect(last.open).toBe(false);
    expect(last.mode).toBe("enable");
  });

  it("invokes onInstructionClose when the instruction modal closes", () => {
    const onInstructionClose = vi.fn();
    const { getByTestId } = render(() => (
      <RoutingModals
        {...makeProps({ instructionModal: () => "enable", onInstructionClose })}
      />
    ));
    fireEvent.click(getByTestId("ri-close"));
    expect(onInstructionClose).toHaveBeenCalled();
  });
});
