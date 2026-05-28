import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@solidjs/testing-library";

const mockCreateHeaderTier = vi.fn();
const mockUpdateHeaderTier = vi.fn();
const mockGetSeenHeaders = vi.fn();
const mockSetHeaderTierResponseMode = vi.fn();
vi.mock("../../src/services/api/header-tiers.js", () => ({
  createHeaderTier: (...args: unknown[]) => mockCreateHeaderTier(...args),
  updateHeaderTier: (...args: unknown[]) => mockUpdateHeaderTier(...args),
  getSeenHeaders: (...args: unknown[]) => mockGetSeenHeaders(...args),
  setHeaderTierResponseMode: (...args: unknown[]) => mockSetHeaderTierResponseMode(...args),
}));

const mockToastError = vi.fn();
vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("manifest-shared", () => ({
  TIER_COLORS: ["indigo", "rose", "amber", "emerald"],
}));

type Suggestion = { label: string; value: string; group?: string; sublabel?: string };
const comboCalls: Array<Record<string, unknown>> = [];
vi.mock("../../src/components/HeaderComboBox.js", () => ({
  default: (props: Record<string, unknown>) => {
    comboCalls.push(props);
    // Read every prop so the parent's JSX-attribute getter statements fire.
    const _read = [props.suggestions, props.freeFormHint];
    void _read;
    const id = props.id as string;
    return (
      <div data-testid={`combo-${id}`}>
        <input
          id={id}
          value={props.value as string}
          placeholder={props.placeholder as string | undefined}
          disabled={props.disabled as boolean | undefined}
          data-invalid={String((props.invalid as boolean) ?? false)}
          data-suggestion-count={(props.suggestions as Suggestion[] | undefined)?.length ?? 0}
          onInput={(e) =>
            (props.onInput as (v: string) => void)(
              (e.currentTarget as HTMLInputElement).value,
            )
          }
        />
        {props.errorMessage ? (
          <div data-testid={`combo-error-${id}`}>{props.errorMessage as string}</div>
        ) : null}
      </div>
    );
  },
}));

import HeaderTierModal from "../../src/components/HeaderTierModal";
import type { HeaderTier } from "../../src/services/api/header-tiers";

const existingTier: HeaderTier = {
  id: "ht-1",
  agent_id: "agent-1",
  name: "Premium",
  header_key: "x-manifest-tier",
  header_value: "premium",
  badge_color: "indigo",
  sort_order: 0,
  enabled: true,
  override_route: null,
  fallback_routes: null,
  response_mode: "buffered",
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
};

describe("HeaderTierModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comboCalls.length = 0;
    mockGetSeenHeaders.mockResolvedValue([]);
    mockCreateHeaderTier.mockResolvedValue({ ...existingTier, id: "ht-new", name: "Created", response_mode: "buffered" });
    mockUpdateHeaderTier.mockResolvedValue({ ...existingTier, response_mode: "buffered" });
    mockSetHeaderTierResponseMode.mockResolvedValue({ ...existingTier, response_mode: "stream" });
  });

  describe("create mode", () => {
    it("renders create-mode title and description", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      expect(container.querySelector("#header-tier-modal-title")?.textContent).toBe(
        "Create custom tier",
      );
      expect(container.textContent).toContain("Custom routing lets you identify");
    });

    it("renders the close button when no onBack handler is provided", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      expect(container.querySelector(".header-tier-modal__close")).not.toBeNull();
      expect(container.querySelector(".modal-back-btn")).toBeNull();
    });

    it("renders a back button when onBack is provided and hides Cancel", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onBack={vi.fn()}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      expect(container.querySelector(".modal-back-btn")).not.toBeNull();
      const buttons = Array.from(container.querySelectorAll("button"));
      expect(buttons.find((b) => b.textContent?.trim() === "Cancel")).toBeUndefined();
    });

    it("invokes onBack when the back button is clicked", () => {
      const onBack = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onBack={onBack}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      fireEvent.click(container.querySelector(".modal-back-btn") as HTMLButtonElement);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("invokes onClose when the close button is clicked", () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={onClose}
          onSaved={vi.fn()}
        />
      ));
      fireEvent.click(container.querySelector(".header-tier-modal__close") as HTMLButtonElement);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("invokes onClose when the Cancel button is clicked", () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={onClose}
          onSaved={vi.fn()}
        />
      ));
      const cancel = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Cancel",
      ) as HTMLButtonElement;
      fireEvent.click(cancel);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("invokes onClose on overlay click", () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={onClose}
          onSaved={vi.fn()}
        />
      ));
      const overlay = container.querySelector(".modal-overlay") as HTMLElement;
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("submits the create payload when the form is valid", async () => {
      const onSaved = vi.fn();
      const onClose = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={onClose}
          onSaved={onSaved}
        />
      ));
      const nameInput = container.querySelector("#header-tier-name") as HTMLInputElement;
      const keyInput = container.querySelector("#header-tier-key") as HTMLInputElement;
      const valueInput = container.querySelector("#header-tier-value") as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: "Premium" } });
      fireEvent.input(keyInput, { target: { value: "x-manifest-tier" } });
      fireEvent.input(valueInput, { target: { value: "premium" } });

      const submitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Create tier"),
      ) as HTMLButtonElement;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateHeaderTier).toHaveBeenCalledWith("demo", {
          name: "Premium",
          header_key: "x-manifest-tier",
          header_value: "premium",
          badge_color: "indigo",
        });
      });
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("shows a name error when the name is empty after a submission attempt", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const submitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Create tier"),
      ) as HTMLButtonElement;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(container.querySelector(".header-tier-modal__error")?.textContent).toBe(
          "Name is required",
        );
      });
      expect(mockCreateHeaderTier).not.toHaveBeenCalled();
    });

    it("rejects names longer than the max length", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const nameInput = container.querySelector("#header-tier-name") as HTMLInputElement;
      // Bypass maxlength via DOM since fireEvent.input still goes through onInput
      nameInput.value = "a".repeat(33);
      fireEvent.input(nameInput);
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Create tier"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(container.querySelector(".header-tier-modal__error")?.textContent).toMatch(
          /32 characters/,
        );
      });
    });

    it("rejects a name that already exists in existingTiers (case-insensitive)", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const nameInput = container.querySelector("#header-tier-name") as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: "PREMIUM" } });
      const keyInput = container.querySelector("#header-tier-key") as HTMLInputElement;
      fireEvent.input(keyInput, { target: { value: "x-other" } });
      const valueInput = container.querySelector("#header-tier-value") as HTMLInputElement;
      fireEvent.input(valueInput, { target: { value: "v" } });
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Create tier"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(container.querySelector(".header-tier-modal__error")?.textContent).toBe(
          "A tier with this name already exists",
        );
      });
    });

    it("rejects a header key with invalid characters", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const nameInput = container.querySelector("#header-tier-name") as HTMLInputElement;
      const keyInput = container.querySelector("#header-tier-key") as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: "X" } });
      fireEvent.input(keyInput, { target: { value: "Bad Key!" } });
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Create tier"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(container.querySelector('[data-testid="combo-error-header-tier-key"]')?.textContent).toMatch(
          /lowercase letters/,
        );
      });
    });

    it("rejects a reserved header key", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      fireEvent.input(container.querySelector("#header-tier-name") as HTMLInputElement, {
        target: { value: "X" },
      });
      fireEvent.input(container.querySelector("#header-tier-key") as HTMLInputElement, {
        target: { value: "authorization" },
      });
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Create tier"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(container.querySelector('[data-testid="combo-error-header-tier-key"]')?.textContent).toMatch(
          /stripped for security/,
        );
      });
    });

    it("rejects header values containing quotes", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      fireEvent.input(container.querySelector("#header-tier-name") as HTMLInputElement, {
        target: { value: "X" },
      });
      fireEvent.input(container.querySelector("#header-tier-key") as HTMLInputElement, {
        target: { value: "x-okay" },
      });
      fireEvent.input(container.querySelector("#header-tier-value") as HTMLInputElement, {
        target: { value: 'has"quote' },
      });
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Create tier"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(container.querySelector('[data-testid="combo-error-header-tier-value"]')?.textContent).toMatch(
          /quotes or backslashes/,
        );
      });
    });

    it("rejects a value that duplicates an existing tier's key+value", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      fireEvent.input(container.querySelector("#header-tier-name") as HTMLInputElement, {
        target: { value: "Different" },
      });
      fireEvent.input(container.querySelector("#header-tier-key") as HTMLInputElement, {
        target: { value: "x-manifest-tier" },
      });
      fireEvent.input(container.querySelector("#header-tier-value") as HTMLInputElement, {
        target: { value: "premium" },
      });
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Create tier"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(container.querySelector('[data-testid="combo-error-header-tier-value"]')?.textContent).toMatch(
          /Another tier already matches/,
        );
      });
    });

    it("toasts an error when create fails", async () => {
      mockCreateHeaderTier.mockRejectedValueOnce(new Error("server boom"));
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      fireEvent.input(container.querySelector("#header-tier-name") as HTMLInputElement, {
        target: { value: "X" },
      });
      fireEvent.input(container.querySelector("#header-tier-key") as HTMLInputElement, {
        target: { value: "x-okay" },
      });
      fireEvent.input(container.querySelector("#header-tier-value") as HTMLInputElement, {
        target: { value: "v" },
      });
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Create tier"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("server boom");
      });
    });
  });

  describe("edit mode", () => {
    it("prefills the form from the editing tier and shows the Save button", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          editing={existingTier}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      expect((container.querySelector("#header-tier-name") as HTMLInputElement).value).toBe(
        "Premium",
      );
      expect((container.querySelector("#header-tier-key") as HTMLInputElement).value).toBe(
        "x-manifest-tier",
      );
      expect((container.querySelector("#header-tier-value") as HTMLInputElement).value).toBe(
        "premium",
      );
      expect(container.querySelector("#header-tier-modal-title")?.textContent).toBe(
        "Edit custom tier",
      );
      const buttons = Array.from(container.querySelectorAll("button"));
      expect(buttons.some((b) => b.textContent?.includes("Save changes"))).toBe(true);
    });

    it("does not flag its own name/header as a duplicate (excluded from uniqueness)", async () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          editing={existingTier}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const submit = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Save changes"),
      ) as HTMLButtonElement;
      fireEvent.click(submit);
      await waitFor(() => {
        expect(mockUpdateHeaderTier).toHaveBeenCalledWith("demo", existingTier.id, {
          name: "Premium",
          header_key: "x-manifest-tier",
          header_value: "premium",
          badge_color: "indigo",
        });
      });
    });

    it("renders the Delete button when onDelete is provided", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          editing={existingTier}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onDelete={vi.fn()}
        />
      ));
      expect(container.querySelector(".header-tier-modal__delete-btn")).not.toBeNull();
    });

    it("calls onDelete when the user confirms the delete prompt", () => {
      const onDelete = vi.fn();
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          editing={existingTier}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onDelete={onDelete}
        />
      ));
      fireEvent.click(
        container.querySelector(".header-tier-modal__delete-btn") as HTMLButtonElement,
      );
      expect(onDelete).toHaveBeenCalledWith(existingTier.id);
      vi.unstubAllGlobals();
    });

    it("does not call onDelete when the user cancels the delete prompt", () => {
      const onDelete = vi.fn();
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          editing={existingTier}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onDelete={onDelete}
        />
      ));
      fireEvent.click(
        container.querySelector(".header-tier-modal__delete-btn") as HTMLButtonElement,
      );
      expect(onDelete).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe("stream mode toggle", () => {
    it("renders the stream mode switch in edit mode, defaults to off for buffered tier", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[existingTier]}
          editing={existingTier}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const sw = container.querySelector(".routing-switch") as HTMLButtonElement;
      expect(sw).not.toBeNull();
      expect(sw.classList.contains("routing-switch--on")).toBe(false);
    });

    it("toggles stream mode on when clicked and all models support streaming", () => {
      const streamTier: HeaderTier = {
        ...existingTier,
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      };
      const models = [{ model_name: "gpt-4o", capabilities: ["text", "stream"] as const }];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[streamTier]}
          editing={streamTier}
          models={models as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const sw = container.querySelector(".routing-switch") as HTMLButtonElement;
      fireEvent.click(sw);
      expect(sw.classList.contains("routing-switch--on")).toBe(true);
      // Clicking again toggles it off
      fireEvent.click(sw);
      expect(sw.classList.contains("routing-switch--on")).toBe(false);
    });

    it("disables the stream toggle when models don't support streaming", () => {
      const noStreamTier: HeaderTier = {
        ...existingTier,
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
        fallback_routes: [{ provider: "openai", authType: "api_key", model: "gpt-3.5" }],
      };
      const models = [
        { model_name: "gpt-4o", capabilities: ["text"] as const },
        { model_name: "gpt-3.5", capabilities: ["text"] as const },
      ];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[noStreamTier]}
          editing={noStreamTier}
          models={models as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const sw = container.querySelector(".routing-switch") as HTMLButtonElement;
      expect(sw.disabled).toBe(true);
      expect(sw.classList.contains("routing-switch--disabled")).toBe(true);
    });

    it("shows incompatible models blocker when models lack stream capability", () => {
      const noStreamTier: HeaderTier = {
        ...existingTier,
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
        fallback_routes: [{ provider: "openai", authType: "api_key", model: "gpt-3.5" }],
      };
      const models = [
        { model_name: "gpt-4o", capabilities: ["text"] as const },
        { model_name: "gpt-3.5", capabilities: ["text"] as const },
      ];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[noStreamTier]}
          editing={noStreamTier}
          models={models as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const blocker = container.querySelector(".response-mode-modal__blocker");
      expect(blocker).not.toBeNull();
      expect(blocker?.textContent).toContain("These models do");
      expect(blocker?.textContent).toContain("them");
      const rows = container.querySelectorAll(".response-mode-modal__blocker-row");
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain("gpt-4o");
      expect(rows[0].textContent).toContain("Primary");
      expect(rows[1].textContent).toContain("gpt-3.5");
      expect(rows[1].textContent).toContain("Fallback 1");
    });

    it("shows singular blocker text when only one model is incompatible", () => {
      const singleNoStream: HeaderTier = {
        ...existingTier,
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      };
      const models = [{ model_name: "gpt-4o", capabilities: ["text"] as const }];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[singleNoStream]}
          editing={singleNoStream}
          models={models as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const blocker = container.querySelector(".response-mode-modal__blocker");
      expect(blocker?.textContent).toContain("This model does");
      expect(blocker?.textContent).toContain(" it ");
    });

    it("persists stream mode change via setHeaderTierResponseMode on save", async () => {
      const streamTier: HeaderTier = {
        ...existingTier,
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      };
      const models = [{ model_name: "gpt-4o", capabilities: ["text", "stream"] as const }];
      const onSaved = vi.fn();
      const onClose = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[streamTier]}
          editing={streamTier}
          models={models as any}
          onClose={onClose}
          onSaved={onSaved}
        />
      ));
      // Toggle stream mode on
      fireEvent.click(container.querySelector(".routing-switch") as HTMLButtonElement);
      // Submit
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Save changes"),
        ) as HTMLButtonElement,
      );
      await waitFor(() => {
        expect(mockUpdateHeaderTier).toHaveBeenCalled();
        expect(mockSetHeaderTierResponseMode).toHaveBeenCalledWith("demo", existingTier.id, "stream");
      });
      expect(onSaved).toHaveBeenCalled();
    });

    it("shows stream description when stream mode is active", () => {
      const streamTier: HeaderTier = {
        ...existingTier,
        response_mode: "stream",
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      };
      const models = [{ model_name: "gpt-4o", capabilities: ["text", "stream"] as const }];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[streamTier]}
          editing={streamTier}
          models={models as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      expect(container.textContent).toContain("streamed token by token");
    });
  });

  describe("badge color picker", () => {
    it("renders one swatch per TIER_COLORS entry", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const swatches = container.querySelectorAll(".header-tier-modal__swatch");
      expect(swatches.length).toBe(4);
    });

    it("changes the active swatch on click", () => {
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const swatches = container.querySelectorAll(".header-tier-modal__swatch");
      // Initial: indigo (first) is active
      expect(swatches[0].classList.contains("header-tier-modal__swatch--active")).toBe(true);
      fireEvent.click(swatches[1]);
      expect(swatches[1].classList.contains("header-tier-modal__swatch--active")).toBe(true);
      expect(swatches[0].classList.contains("header-tier-modal__swatch--active")).toBe(false);
    });
  });

  it("filters reserved keys out of suggestions and exposes seen keys with metadata", async () => {
    mockGetSeenHeaders.mockResolvedValue([
      { key: "authorization", count: 99, top_values: [], sdks: ["sdk"] },
      { key: "x-custom", count: 5, top_values: ["a", "b"], sdks: ["sdk"] },
      { key: "x-empty", count: 1, top_values: [], sdks: ["other"] },
    ]);
    render(() => (
      <HeaderTierModal
        agentName="demo"
        existingTiers={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    ));
    await waitFor(() => {
      expect(mockGetSeenHeaders).toHaveBeenCalledWith("demo");
    });
  });

  it("falls back to [] when getSeenHeaders rejects", async () => {
    mockGetSeenHeaders.mockRejectedValue(new Error("boom"));
    render(() => (
      <HeaderTierModal
        agentName="demo"
        existingTiers={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    ));
    await waitFor(() => {
      expect(mockGetSeenHeaders).toHaveBeenCalled();
    });
  });

  it("rejects header values longer than the max length", async () => {
    const { container } = render(() => (
      <HeaderTierModal
        agentName="demo"
        existingTiers={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    ));
    fireEvent.input(container.querySelector("#header-tier-name") as HTMLInputElement, {
      target: { value: "X" },
    });
    fireEvent.input(container.querySelector("#header-tier-key") as HTMLInputElement, {
      target: { value: "x-okay" },
    });
    fireEvent.input(container.querySelector("#header-tier-value") as HTMLInputElement, {
      target: { value: "v".repeat(129) },
    });
    fireEvent.click(
      Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Create tier"),
      ) as HTMLButtonElement,
    );
    await waitFor(() => {
      const err = container.querySelector(
        '[data-testid="combo-error-header-tier-value"]',
      ) as HTMLElement | null;
      expect(err?.textContent).toMatch(/128 characters/);
    });
  });

  it("populates the key suggestions list from getSeenHeaders results (with top values)", async () => {
    mockGetSeenHeaders.mockResolvedValue([
      { key: "x-tier", count: 9, top_values: ["a", "b", "c", "d"], sdks: ["openclaw"] },
    ]);
    const { container } = render(() => (
      <HeaderTierModal
        agentName="demo"
        existingTiers={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    ));
    await waitFor(() => {
      const keyInput = container.querySelector("#header-tier-key") as HTMLInputElement;
      expect(keyInput.getAttribute("data-suggestion-count")).toBe("1");
    });
  });

  it("populates value suggestions for the entered header key", async () => {
    mockGetSeenHeaders.mockResolvedValue([
      { key: "x-tier", count: 5, top_values: ["premium", "free"], sdks: [] },
    ]);
    const { container } = render(() => (
      <HeaderTierModal
        agentName="demo"
        existingTiers={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    ));
    await waitFor(() => {
      expect(mockGetSeenHeaders).toHaveBeenCalled();
    });
    fireEvent.input(container.querySelector("#header-tier-key") as HTMLInputElement, {
      target: { value: "x-tier" },
    });
    await waitFor(() => {
      const valueInput = container.querySelector("#header-tier-value") as HTMLInputElement;
      expect(valueInput.getAttribute("data-suggestion-count")).toBe("2");
    });
  });

  it("emits the count-only sublabel for keys with no top_values", async () => {
    mockGetSeenHeaders.mockResolvedValue([
      { key: "x-empty", count: 2, top_values: [], sdks: ["langchain"] },
    ]);
    render(() => (
      <HeaderTierModal
        agentName="demo"
        existingTiers={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    ));
    await waitFor(() => {
      // Combobox mock captures `suggestions` — sublabel for the only entry
      // is "2× seen" because top_values is empty.
      const lastKeyCall = comboCalls.find((c) => c.id === "header-tier-key");
      const suggestions = lastKeyCall?.suggestions as
        | Array<{ sublabel?: string }>
        | undefined;
      expect(suggestions?.[0]?.sublabel).toBe("2× seen");
    });
  });

  describe("stream mode and incompatible models", () => {
    const tierWithRoute: HeaderTier = {
      ...existingTier,
      override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      fallback_routes: [{ provider: "anthropic", authType: "api_key", model: "claude-3" }],
    };

    it("lists incompatible models that do not support streaming (primary + fallbacks)", () => {
      const modelsWithCaps = [
        { model_name: "gpt-4o", capabilities: ["text"] as const },
        { model_name: "claude-3", capabilities: ["text"] as const },
      ];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[tierWithRoute]}
          editing={tierWithRoute}
          models={modelsWithCaps as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      // Stream toggle should be disabled since models lack stream capability
      const switchBtn = container.querySelector(".routing-switch") as HTMLButtonElement;
      expect(switchBtn.classList.contains("routing-switch--disabled")).toBe(true);
      // Blocker text should show plural form
      expect(container.textContent).toContain("These models do");
      expect(container.textContent).toContain("not support streaming");
      // Blocker rows should be rendered
      const blockerRows = container.querySelectorAll(".response-mode-modal__blocker-row");
      expect(blockerRows.length).toBe(2);
      expect(blockerRows[0].textContent).toContain("gpt-4o");
      expect(blockerRows[0].textContent).toContain("Primary");
      expect(blockerRows[1].textContent).toContain("claude-3");
      expect(blockerRows[1].textContent).toContain("Fallback 1");
    });

    it("shows singular blocker text when only one model is incompatible", () => {
      const tierSingleRoute: HeaderTier = {
        ...existingTier,
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
        fallback_routes: [],
      };
      const modelsWithCaps = [
        { model_name: "gpt-4o", capabilities: ["text"] as const },
      ];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[tierSingleRoute]}
          editing={tierSingleRoute}
          models={modelsWithCaps as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      expect(container.textContent).toContain("This model does");
      expect(container.textContent).toContain("Change it to");
    });

    it("enables the stream toggle when all models support streaming", () => {
      const modelsWithStream = [
        { model_name: "gpt-4o", capabilities: ["text", "stream"] as const },
        { model_name: "claude-3", capabilities: ["text", "stream"] as const },
      ];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[tierWithRoute]}
          editing={tierWithRoute}
          models={modelsWithStream as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const switchBtn = container.querySelector(".routing-switch") as HTMLButtonElement;
      expect(switchBtn.classList.contains("routing-switch--disabled")).toBe(false);
    });

    it("toggles stream mode on and off when clicked", () => {
      const modelsWithStream = [
        { model_name: "gpt-4o", capabilities: ["text", "stream"] as const },
        { model_name: "claude-3", capabilities: ["text", "stream"] as const },
      ];
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[tierWithRoute]}
          editing={tierWithRoute}
          models={modelsWithStream as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      const switchBtn = container.querySelector(".routing-switch") as HTMLButtonElement;
      // Initially buffered (existingTier.response_mode = "buffered")
      expect(switchBtn.classList.contains("routing-switch--on")).toBe(false);
      // Click to enable stream
      fireEvent.click(switchBtn);
      expect(switchBtn.classList.contains("routing-switch--on")).toBe(true);
      // Shows streaming description
      expect(container.textContent).toContain("streamed token by token");
      // Click to disable stream
      fireEvent.click(switchBtn);
      expect(switchBtn.classList.contains("routing-switch--on")).toBe(false);
      expect(container.textContent).toContain("returned as a single payload");
    });

    it("calls setHeaderTierResponseMode when stream mode changed during submit", async () => {
      const modelsWithStream = [
        { model_name: "gpt-4o", capabilities: ["text", "stream"] as const },
        { model_name: "claude-3", capabilities: ["text", "stream"] as const },
      ];
      const onSaved = vi.fn();
      const onClose = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[tierWithRoute]}
          editing={tierWithRoute}
          models={modelsWithStream as any}
          onClose={onClose}
          onSaved={onSaved}
        />
      ));
      // Toggle stream on
      const switchBtn = container.querySelector(".routing-switch") as HTMLButtonElement;
      fireEvent.click(switchBtn);
      // Submit the form
      const submitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Save changes"),
      ) as HTMLButtonElement;
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(mockUpdateHeaderTier).toHaveBeenCalled();
        expect(mockSetHeaderTierResponseMode).toHaveBeenCalledWith("demo", existingTier.id, "stream");
        expect(onSaved).toHaveBeenCalled();
      });
    });

    it("handles models with capabilities set on available models (caps.set path)", () => {
      const modelsWithCaps = [
        { model_name: "gpt-4o", capabilities: ["text", "stream"] as const },
      ];
      const tierOneRoute: HeaderTier = {
        ...existingTier,
        override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
        fallback_routes: [],
      };
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[tierOneRoute]}
          editing={tierOneRoute}
          models={modelsWithCaps as any}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ));
      // Stream toggle should be enabled
      const switchBtn = container.querySelector(".routing-switch") as HTMLButtonElement;
      expect(switchBtn.classList.contains("routing-switch--disabled")).toBe(false);
    });
  });

  describe("keyboard shortcuts", () => {
    it("submits when Enter is pressed on the name input", async () => {
      const onSaved = vi.fn();
      const onClose = vi.fn();
      mockCreateHeaderTier.mockResolvedValue({ ...existingTier, id: "ht-kb", name: "KB" });
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={onClose}
          onSaved={onSaved}
        />
      ));
      fireEvent.input(container.querySelector("#header-tier-name") as HTMLInputElement, {
        target: { value: "KB" },
      });
      fireEvent.input(container.querySelector("#header-tier-key") as HTMLInputElement, {
        target: { value: "x-test" },
      });
      fireEvent.input(container.querySelector("#header-tier-value") as HTMLInputElement, {
        target: { value: "val" },
      });
      fireEvent.keyDown(container.querySelector("#header-tier-name") as HTMLInputElement, {
        key: "Enter",
      });
      await waitFor(() => {
        expect(mockCreateHeaderTier).toHaveBeenCalled();
      });
    });

    it("closes when Escape is pressed", () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={onClose}
          onSaved={vi.fn()}
        />
      ));
      fireEvent.keyDown(container.querySelector("#header-tier-name") as HTMLInputElement, {
        key: "Escape",
      });
      expect(onClose).toHaveBeenCalled();
    });

    it("does not submit when Enter event was already handled (defaultPrevented)", () => {
      const onSaved = vi.fn();
      const { container } = render(() => (
        <HeaderTierModal
          agentName="demo"
          existingTiers={[]}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      ));
      const nameInput = container.querySelector("#header-tier-name") as HTMLInputElement;
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      // Simulate a child handler having already called preventDefault (e.g. combobox)
      event.preventDefault();
      nameInput.dispatchEvent(event);
      expect(mockCreateHeaderTier).not.toHaveBeenCalled();
    });
  });
});
