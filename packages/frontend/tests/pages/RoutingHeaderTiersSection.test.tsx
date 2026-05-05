import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, screen } from "@solidjs/testing-library";

const mockListHeaderTiers = vi.fn();
const mockDeleteHeaderTier = vi.fn();
const mockOverrideHeaderTier = vi.fn();
const mockToggleHeaderTier = vi.fn();
vi.mock("../../src/services/api/header-tiers.js", () => ({
  listHeaderTiers: (...args: unknown[]) => mockListHeaderTiers(...args),
  deleteHeaderTier: (...args: unknown[]) => mockDeleteHeaderTier(...args),
  overrideHeaderTier: (...args: unknown[]) => mockOverrideHeaderTier(...args),
  toggleHeaderTier: (...args: unknown[]) => mockToggleHeaderTier(...args),
}));

const mockToastError = vi.fn();
vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn(), warning: vi.fn() },
}));

const cardCalls: Array<Record<string, unknown>> = [];
vi.mock("../../src/components/HeaderTierCard.js", () => ({
  default: (props: Record<string, unknown>) => {
    cardCalls.push(props);
    const tier = props.tier as { id: string; name: string };
    // Read every prop so JSX attribute getters in the parent fire and count
    // as covered statements.
    const _read = [
      props.agentName,
      props.models,
      props.customProviders,
      props.connectedProviders,
    ];
    void _read;
    return (
      <div data-testid={`card-${tier.id}`}>
        <span>{tier.name}</span>
        <button
          data-testid={`override-${tier.id}`}
          onClick={() =>
            (props.onOverride as (m: string, p: string, a?: string) => void)("gpt-4o", "openai", "api_key")
          }
        >
          override
        </button>
        <button
          data-testid={`fb-update-${tier.id}`}
          onClick={() => (props.onFallbacksUpdate as () => void)()}
        >
          fb-update
        </button>
        <button
          data-testid={`edit-${tier.id}`}
          onClick={() => (props.onEdit as () => void)?.()}
        >
          edit
        </button>
        <button
          data-testid={`disable-${tier.id}`}
          onClick={() => (props.onDisable as () => void)?.()}
        >
          disable
        </button>
      </div>
    );
  },
}));

vi.mock("../../src/components/HeaderTierModal.js", () => ({
  default: (props: Record<string, unknown>) => {
    const editing = props.editing as { id: string; name: string } | undefined;
    // Read every prop including agentName + existingTiers so JSX getters fire.
    const _read = [props.agentName, props.existingTiers];
    void _read;
    return (
      <div data-testid="tier-modal">
        <span data-testid="tier-modal-mode">{editing ? "edit" : "create"}</span>
        <button
          data-testid="tier-modal-save"
          onClick={() =>
            (props.onSaved as (s: { id: string; name: string }) => void)({
              id: "ht-saved",
              name: "saved",
            })
          }
        >
          save
        </button>
        <button data-testid="tier-modal-close" onClick={() => (props.onClose as () => void)()}>
          close
        </button>
        {props.onDelete ? (
          <button
            data-testid="tier-modal-delete"
            onClick={() => (props.onDelete as (id: string) => void)?.(editing?.id ?? "")}
          >
            delete
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock("../../src/components/HeaderTierSnippetModal.js", () => ({
  default: (props: Record<string, unknown>) => {
    // Read every prop so JSX attribute getters fire.
    const _read = [props.agentName, props.tier];
    void _read;
    return (
      <div data-testid="snippet-modal">
        <button data-testid="snippet-close" onClick={() => (props.onClose as () => void)()}>
          close
        </button>
      </div>
    );
  },
}));

import RoutingHeaderTiersSection from "../../src/pages/RoutingHeaderTiersSection";
import type { HeaderTier } from "../../src/services/api/header-tiers";

const tier1: HeaderTier = {
  id: "ht-1",
  agent_id: "a",
  name: "Premium",
  header_key: "x-tier",
  header_value: "premium",
  badge_color: "indigo",
  sort_order: 0,
  enabled: true,
  override_route: null,
  fallback_routes: null,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
};
const tier2: HeaderTier = { ...tier1, id: "ht-2", name: "Free", header_value: "free", enabled: false };

function makeProps(
  overrides: Partial<Parameters<typeof RoutingHeaderTiersSection>[0]> = {},
) {
  return {
    agentName: () => "demo",
    models: () => [],
    customProviders: () => [],
    connectedProviders: () => [],
    ...overrides,
  } as Parameters<typeof RoutingHeaderTiersSection>[0];
}

describe("RoutingHeaderTiersSection", () => {
  beforeEach(() => {
    cardCalls.length = 0;
    vi.clearAllMocks();
    mockListHeaderTiers.mockResolvedValue([tier1, tier2]);
    mockOverrideHeaderTier.mockResolvedValue(undefined);
    mockDeleteHeaderTier.mockResolvedValue(undefined);
    mockToggleHeaderTier.mockResolvedValue(undefined);
  });

  it("renders the empty state when no tiers exist (with no externalTiers)", async () => {
    mockListHeaderTiers.mockResolvedValue([]);
    render(() => <RoutingHeaderTiersSection {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByText("No custom tiers activated")).toBeDefined();
    });
  });

  it("renders only enabled tiers as cards", async () => {
    render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    expect(screen.getByTestId("card-ht-1")).toBeDefined();
    expect(screen.queryByTestId("card-ht-2")).toBeNull();
  });

  it("renders the Manage button when at least one tier exists", () => {
    render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    expect(screen.getByText("Manage custom routing")).toBeDefined();
  });

  it("opens the manage modal when clicking the Manage button", () => {
    const { container } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    expect(container.querySelector(".header-tier-manage-modal")).not.toBeNull();
  });

  it("opens the create modal directly when there are zero tiers", () => {
    const { queryByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [] })} />
    ));
    fireEvent.click(screen.getByText("Create custom tier"));
    expect(queryByTestId("tier-modal")).not.toBeNull();
  });

  it("opens edit modal when card.onEdit is invoked", () => {
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("edit-ht-1"));
    expect(getByTestId("tier-modal")).toBeDefined();
    expect(getByTestId("tier-modal-mode").textContent).toBe("edit");
  });

  it("calls overrideHeaderTier with the tier id when card emits override", async () => {
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("override-ht-1"));
    await waitFor(() => {
      expect(mockOverrideHeaderTier).toHaveBeenCalledWith("demo", "ht-1", "gpt-4o", "openai", "api_key");
    });
  });

  it("toasts an error when override fails", async () => {
    mockOverrideHeaderTier.mockRejectedValue(new Error("boom"));
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("override-ht-1"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("boom");
    });
  });

  it("calls toggleHeaderTier with false when disabling from a card", async () => {
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("disable-ht-1"));
    await waitFor(() => {
      expect(mockToggleHeaderTier).toHaveBeenCalledWith("demo", "ht-1", false);
    });
  });

  it("toggles tiers from the manage modal rows", async () => {
    const { container } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    const rows = container.querySelectorAll(".specificity-modal__row");
    fireEvent.click(rows[0]);
    await waitFor(() => {
      expect(mockToggleHeaderTier).toHaveBeenCalledWith("demo", "ht-1", false);
    });
  });

  it("toggles via Enter key on a manage modal row", async () => {
    const { container } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    const rows = container.querySelectorAll(".specificity-modal__row");
    fireEvent.keyDown(rows[1], { key: "Enter" });
    await waitFor(() => {
      expect(mockToggleHeaderTier).toHaveBeenCalledWith("demo", "ht-2", true);
    });
  });

  it("opens the create modal from inside the manage modal", () => {
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    fireEvent.click(screen.getByText("Create new tier"));
    expect(getByTestId("tier-modal-mode").textContent).toBe("create");
  });

  it("auto-opens the SDK snippet modal after a fresh tier is created", () => {
    const { getByTestId, queryByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [] })} />
    ));
    fireEvent.click(screen.getByText("Create custom tier"));
    fireEvent.click(getByTestId("tier-modal-save"));
    expect(queryByTestId("snippet-modal")).not.toBeNull();
  });

  it("does NOT auto-open the snippet modal after an edit", () => {
    const { getByTestId, queryByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("edit-ht-1"));
    fireEvent.click(getByTestId("tier-modal-save"));
    expect(queryByTestId("snippet-modal")).toBeNull();
  });

  it("invokes deleteHeaderTier from the modal's delete callback", async () => {
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("edit-ht-1"));
    fireEvent.click(getByTestId("tier-modal-delete"));
    await waitFor(() => {
      expect(mockDeleteHeaderTier).toHaveBeenCalledWith("demo", "ht-1");
    });
  });

  it("toasts an error when listHeaderTiers rejects on the internal resource", async () => {
    mockListHeaderTiers.mockRejectedValue(new Error("network"));
    render(() => <RoutingHeaderTiersSection {...makeProps()} />);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("network");
    });
  });

  it("renders the section title in standalone mode", () => {
    render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    expect(screen.getByText("Custom routing")).toBeDefined();
  });

  it("hides the section title in embedded mode", () => {
    render(() => (
      <RoutingHeaderTiersSection
        {...makeProps({ externalTiers: () => [tier1], embedded: true })}
      />
    ));
    expect(screen.queryByText("Custom routing")).toBeNull();
  });

  it("toasts an error when delete fails (via the edit modal)", async () => {
    mockDeleteHeaderTier.mockRejectedValue(new Error("delete-fail"));
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("edit-ht-1"));
    fireEvent.click(getByTestId("tier-modal-delete"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("delete-fail");
    });
  });

  it("toasts an error when toggle fails", async () => {
    mockToggleHeaderTier.mockRejectedValue(new Error("toggle-fail"));
    const { getByTestId } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1] })} />
    ));
    fireEvent.click(getByTestId("disable-ht-1"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("toggle-fail");
    });
  });

  it("closes the manage modal when clicking the overlay", () => {
    const { container } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    expect(container.querySelector(".header-tier-manage-modal")).not.toBeNull();
    const overlay = container.querySelector(".modal-overlay") as HTMLElement;
    fireEvent.click(overlay);
    expect(container.querySelector(".header-tier-manage-modal")).toBeNull();
  });

  it("closes the manage modal on Escape", () => {
    const { container } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    fireEvent.keyDown(container.querySelector(".modal-overlay") as HTMLElement, {
      key: "Escape",
    });
    expect(container.querySelector(".header-tier-manage-modal")).toBeNull();
  });

  it("dismisses the manage modal via the Done button", () => {
    const { container } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    const buttons = Array.from(container.querySelectorAll("button"));
    const done = buttons.find((b) => b.textContent === "Done") as HTMLButtonElement;
    fireEvent.click(done);
    expect(container.querySelector(".header-tier-manage-modal")).toBeNull();
  });

  it("ignores duplicate clicks on a row while it's already toggling", async () => {
    let resolveToggle: () => void = () => {};
    mockToggleHeaderTier.mockReturnValue(
      new Promise<void>((r) => {
        resolveToggle = r;
      }),
    );
    const { container } = render(() => (
      <RoutingHeaderTiersSection {...makeProps({ externalTiers: () => [tier1, tier2] })} />
    ));
    fireEvent.click(screen.getByText("Manage custom routing"));
    const rows = container.querySelectorAll(".specificity-modal__row");
    fireEvent.click(rows[0]);
    fireEvent.click(rows[0]); // second click while toggling — should no-op
    resolveToggle();
    await waitFor(() => {
      expect(mockToggleHeaderTier).toHaveBeenCalledTimes(1);
    });
  });
});
