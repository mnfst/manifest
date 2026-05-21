import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import {
  DrawerActionBar,
  DrawerHeader,
  DrawerMetrics,
  DrawerTabs,
  DRAWER_TABS,
  metadataVisible,
  type ActionBarProps,
  type TabId,
  type TabCounts,
} from "../../src/components/RecordedDrawerChrome";
import type { MessageDetailResponse } from "../../src/services/api";

function defaultProps(overrides: Partial<ActionBarProps> = {}): ActionBarProps {
  return {
    hasRequestBody: true,
    hasResponseBody: true,
    onCopyRequest: vi.fn(),
    onCopyResponse: vi.fn(),
    hasRecording: true,
    overflowOpen: false,
    onToggleOverflow: vi.fn(),
    confirmingDelete: false,
    onStartDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    deleting: false,
    ...overrides,
  };
}

describe("DrawerActionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the overflow button when hasRecording is true", () => {
    render(() => <DrawerActionBar {...defaultProps()} />);
    const btn = screen.getByLabelText("More actions");
    expect(btn).toBeDefined();
  });

  it("renders nothing in the overflow area when hasRecording is false", () => {
    render(() => <DrawerActionBar {...defaultProps({ hasRecording: false })} />);
    expect(document.querySelector(".recorded-drawer__overflow")).toBeNull();
  });

  it("calls onToggleOverflow when overflow button is clicked", async () => {
    const onToggle = vi.fn();
    render(() => <DrawerActionBar {...defaultProps({ onToggleOverflow: onToggle })} />);
    await fireEvent.click(screen.getByLabelText("More actions"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows 'Delete recording' menu item when overflowOpen is true", () => {
    render(() => <DrawerActionBar {...defaultProps({ overflowOpen: true })} />);
    expect(screen.getByText("Delete recording")).toBeDefined();
  });

  it("calls onStartDelete when 'Delete recording' is clicked", async () => {
    const onStart = vi.fn();
    render(() => (
      <DrawerActionBar {...defaultProps({ overflowOpen: true, onStartDelete: onStart })} />
    ));
    await fireEvent.click(screen.getByText("Delete recording"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("closes menu on click outside (pointerdown)", async () => {
    const onToggle = vi.fn();
    render(() => (
      <div>
        <span data-testid="outside">outside</span>
        <DrawerActionBar {...defaultProps({ overflowOpen: true, onToggleOverflow: onToggle })} />
      </div>
    ));
    // pointerdown outside the wrapper should trigger onToggleOverflow
    const outside = screen.getByTestId("outside");
    await fireEvent.pointerDown(outside);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("closes menu on Escape key", async () => {
    const onToggle = vi.fn();
    render(() => (
      <DrawerActionBar {...defaultProps({ overflowOpen: true, onToggleOverflow: onToggle })} />
    ));
    // fire keydown Escape on document
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(event);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not close on non-Escape key", () => {
    const onToggle = vi.fn();
    render(() => (
      <DrawerActionBar {...defaultProps({ overflowOpen: true, onToggleOverflow: onToggle })} />
    ));
    const event = new KeyboardEvent("keydown", { key: "a", bubbles: true });
    document.dispatchEvent(event);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("shows confirm UI when confirmingDelete is true", () => {
    render(() => (
      <DrawerActionBar {...defaultProps({ overflowOpen: true, confirmingDelete: true })} />
    ));
    expect(screen.getByText("Delete? The message stays in your log.")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
    expect(screen.getByText("Confirm delete")).toBeDefined();
  });

  it("calls onCancelDelete on Cancel click", async () => {
    const onCancel = vi.fn();
    render(() => (
      <DrawerActionBar
        {...defaultProps({ overflowOpen: true, confirmingDelete: true, onCancelDelete: onCancel })}
      />
    ));
    await fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirmDelete on Confirm delete click", async () => {
    const onConfirm = vi.fn();
    render(() => (
      <DrawerActionBar
        {...defaultProps({
          overflowOpen: true,
          confirmingDelete: true,
          onConfirmDelete: onConfirm,
        })}
      />
    ));
    await fireEvent.click(screen.getByText("Confirm delete"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows spinner and disables buttons when deleting is true", () => {
    render(() => (
      <DrawerActionBar
        {...defaultProps({ overflowOpen: true, confirmingDelete: true, deleting: true })}
      />
    ));
    // "Confirm delete" text should NOT be present; a spinner should be shown instead
    expect(document.querySelector(".spinner")).not.toBeNull();
    // Both buttons should be disabled
    const buttons = document.querySelectorAll(".recorded-drawer__overflow-menu button");
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("does not fire click-outside when clicking inside the wrapper", async () => {
    const onToggle = vi.fn();
    render(() => (
      <DrawerActionBar {...defaultProps({ overflowOpen: true, onToggleOverflow: onToggle })} />
    ));
    // Click inside the overflow menu
    const menuItem = screen.getByText("Delete recording");
    await fireEvent.pointerDown(menuItem);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("sets aria-expanded correctly based on overflowOpen", () => {
    const { unmount } = render(() => <DrawerActionBar {...defaultProps({ overflowOpen: false })} />);
    const btn = screen.getByLabelText("More actions");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    unmount();

    render(() => <DrawerActionBar {...defaultProps({ overflowOpen: true })} />);
    const btn2 = screen.getByLabelText("More actions");
    expect(btn2.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("DrawerTabs", () => {
  it("renders all tab buttons", () => {
    const onChange = vi.fn();
    render(() => (
      <DrawerTabs active="conversation" onChange={onChange} counts={{ conversation: 5, tools: 2 }} />
    ));
    for (const tab of DRAWER_TABS) {
      expect(screen.getByText(tab.label, { exact: false })).toBeDefined();
    }
  });

  it("marks the active tab with aria-selected and active class", () => {
    render(() => (
      <DrawerTabs active="tools" onChange={vi.fn()} counts={{ conversation: 3, tools: 1 }} />
    ));
    const toolsTab = screen.getByRole("tab", { name: /Tools/ });
    expect(toolsTab.getAttribute("aria-selected")).toBe("true");
    expect(toolsTab.classList.contains("panel__tab--active")).toBe(true);

    const convTab = screen.getByRole("tab", { name: /Conversation/ });
    expect(convTab.getAttribute("aria-selected")).toBe("false");
    expect(convTab.classList.contains("panel__tab--active")).toBe(false);
  });

  it("calls onChange with the tab id when clicked", async () => {
    const onChange = vi.fn();
    render(() => (
      <DrawerTabs active="conversation" onChange={onChange} counts={{ conversation: 0, tools: 0 }} />
    ));
    await fireEvent.click(screen.getByRole("tab", { name: /Tools/ }));
    expect(onChange).toHaveBeenCalledWith("tools");
  });

  it("displays counts for tabs that have a countKey", () => {
    render(() => (
      <DrawerTabs active="conversation" onChange={vi.fn()} counts={{ conversation: 12, tools: 3 }} />
    ));
    // Conversation tab should show (12)
    const convTab = screen.getByRole("tab", { name: /Conversation/ });
    expect(convTab.textContent).toContain("(12)");
    // Tools tab should show (3)
    const toolsTab = screen.getByRole("tab", { name: /Tools/ });
    expect(toolsTab.textContent).toContain("(3)");
    // Response tab should NOT show a count
    const respTab = screen.getByRole("tab", { name: /Response/ });
    expect(respTab.textContent).not.toContain("(");
  });
});

function baseMessage() {
  return {
    id: "msg-1",
    timestamp: "2026-02-16 10:00:00",
    model: "openai/gpt-4o",
    provider: "openai",
    auth_type: "api_key",
    status: "ok",
    input_tokens: 12,
    output_tokens: 6,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    cost_usd: 0.0001,
    duration_ms: 420,
    routing_tier: "standard",
    routing_reason: "scored",
    provider_key_label: null,
    request_headers: {},
    caller_attribution: null,
  };
}

describe("DrawerHeader — toggleMetadata + Copy response", () => {
  it("calls toggleMetadata when the metadata button is clicked", async () => {
    const initial = metadataVisible();
    render(() => (
      <DrawerHeader
        data={{ message: baseMessage() } as unknown as MessageDetailResponse}
        onClose={vi.fn()}
        hasRequestBody={false}
        hasResponseBody={true}
        hasRecording={false}
        overflowOpen={false}
        onToggleOverflow={vi.fn()}
        confirmingDelete={false}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
        deleting={false}
      />
    ));
    const btn = screen.getByLabelText(initial ? "Hide metadata" : "Show metadata");
    await fireEvent.click(btn);
    expect(metadataVisible()).toBe(!initial);
    // Click again to restore
    await fireEvent.click(btn);
    expect(metadataVisible()).toBe(initial);
  });

  it("fires onCopyResponse and onToggleOverflow when 'Copy response' is clicked", async () => {
    const onCopyResponse = vi.fn();
    const onToggleOverflow = vi.fn();
    render(() => (
      <DrawerHeader
        data={{ message: baseMessage() } as unknown as MessageDetailResponse}
        onClose={vi.fn()}
        hasRequestBody={false}
        hasResponseBody={true}
        hasRecording={false}
        overflowOpen={true}
        onToggleOverflow={onToggleOverflow}
        onCopyResponse={onCopyResponse}
        confirmingDelete={false}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
        deleting={false}
      />
    ));
    const copyBtn = screen.getByText("Copy response");
    await fireEvent.click(copyBtn);
    expect(onCopyResponse).toHaveBeenCalledTimes(1);
    expect(onToggleOverflow).toHaveBeenCalledTimes(1);
  });
});

describe("DrawerMetrics — SDK field", () => {
  it("renders the SDK meta field when caller_attribution.sdk is present", () => {
    const msg = {
      ...baseMessage(),
      caller_attribution: { sdk: "vercel-ai-sdk" },
    };
    render(() => (
      <DrawerMetrics
        message={msg as unknown as MessageDetailResponse["message"]}
        recording={null}
      />
    ));
    const metrics = document.querySelector('[aria-label="Call metrics"]')!;
    expect(metrics.textContent).toContain("SDK");
    expect(metrics.textContent).toContain("vercel-ai-sdk");
  });
});
