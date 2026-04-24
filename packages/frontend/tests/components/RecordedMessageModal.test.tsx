import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockNavigate = vi.fn();
let mockPathname = "/agents/test-agent/messages";
vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

const mockGetMessageDetails = vi.fn();
const mockDeleteMessageRecording = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getMessageDetails: (...a: unknown[]) => mockGetMessageDetails(...a),
  deleteMessageRecording: (...a: unknown[]) => mockDeleteMessageRecording(...a),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
import { toast as mockToast } from "../../src/services/toast-store.js";

// Use the real formatters so assertions exercise the actual formatting
// code path, not an identity stub — a bug in `formatCost` or `formatNumber`
// would otherwise pass these tests silently.
vi.mock("../../src/services/formatters.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/formatters.js")>(
    "../../src/services/formatters.js",
  );
  return { ...actual };
});

vi.mock("../../src/components/CodeBlock.jsx", () => ({
  default: (props: { code: string; language: string }) => (
    <pre data-testid={`code-${props.language}`}>{props.code}</pre>
  ),
}));

import RecordedMessageModal from "../../src/components/RecordedMessageModal";

const q = (sel: string) => document.querySelector(sel);
const findButton = (text: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );

function baseDetails(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      id: "msg-1",
      timestamp: "2026-02-16 10:00:00",
      model: "gpt-4o",
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
      request_headers: { "user-agent": "test" },
    },
    recording: {
      request_body: {
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "hi there" },
          { role: "assistant", content: "hello back" },
        ],
      },
      response_body: {
        type: "json",
        body: {
          id: "chatcmpl-1",
          model: "gpt-4o",
          choices: [
            { index: 0, message: { role: "assistant", content: "hello back" }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        },
      },
      response_headers: { "content-type": "application/json" },
      size_bytes: 300,
      created_at: "",
    },
    llm_calls: [],
    tool_executions: [],
    agent_logs: [],
    ...overrides,
  };
}

describe("RecordedMessageModal (drawer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/agents/test-agent/messages";
    mockGetMessageDetails.mockResolvedValue(baseDetails());
    mockDeleteMessageRecording.mockResolvedValue(undefined);
  });

  it("renders nothing when closed", () => {
    render(() => <RecordedMessageModal open={false} messageId={null} onClose={vi.fn()} />);
    expect(q(".recorded-drawer")).toBeNull();
  });

  it("does not fetch when messageId is null", () => {
    render(() => <RecordedMessageModal open={true} messageId={null} onClose={vi.fn()} />);
    expect(mockGetMessageDetails).not.toHaveBeenCalled();
  });

  it("renders the drawer with header + metrics + essentials + tabs", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(screen.getByText("Recorded message")).toBeDefined();
    });
    expect(q(".recorded-drawer")).not.toBeNull();
    expect(q(".recorded-drawer__metrics")).not.toBeNull();
    expect(q(".recorded-modal__essentials")).not.toBeNull();
    expect(q(".recorded-drawer__tabs")).not.toBeNull();
  });

  it("shows the metric pills with token and cost values", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const pills = q(".recorded-drawer__metrics")!.textContent ?? "";
      expect(pills).toContain("input");
      expect(pills).toContain("output");
      expect(pills).toContain("total");
      expect(pills).toContain("cost");
      expect(pills).toContain("standard"); // tier
    });
  });

  it("surfaces last user + assistant reply in the essentials card", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const ess = q(".recorded-modal__essentials")!;
      expect(ess.textContent).toContain("Final user message");
      expect(ess.textContent).toContain("hi there");
      expect(ess.textContent).toContain("Assistant reply");
      expect(ess.textContent).toContain("hello back");
    });
  });

  it("switches tabs when tab buttons are clicked", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const tab = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(tab?.textContent).toContain("Conversation");
      expect(tab?.textContent).toContain("3");
    });

    fireEvent.click(findButton("Headers")!);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Request headers");
      expect(document.body.textContent).toContain("Response headers");
    });

    fireEvent.click(findButton("Raw")!);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('[data-testid="code-json"]').length).toBeGreaterThan(0);
    });
  });

  it("renders conversation turn rows by default, system collapsed", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const turns = document.querySelectorAll(".recorded-modal__turn");
      expect(turns.length).toBe(3);
    });
    // System turn should be compact by default
    const systemTurn = Array.from(document.querySelectorAll(".recorded-modal__turn"))
      .find((t) => (t as HTMLElement).dataset.role === "system");
    expect(systemTurn?.classList.contains("recorded-modal__turn--compact")).toBe(true);
    // User turn should be expanded
    const userTurn = Array.from(document.querySelectorAll(".recorded-modal__turn"))
      .find((t) => (t as HTMLElement).dataset.role === "user");
    expect(userTurn?.classList.contains("recorded-modal__turn--compact")).toBe(false);
  });

  it("toggles a turn open when clicking its header", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(3));
    const systemTurn = Array.from(document.querySelectorAll(".recorded-modal__turn"))
      .find((t) => (t as HTMLElement).dataset.role === "system")!;
    const header = systemTurn.querySelector(".recorded-modal__turn-header") as HTMLElement;
    fireEvent.click(header);
    expect(systemTurn.classList.contains("recorded-modal__turn--compact")).toBe(false);
  });

  it("filters turns by role when a filter chip is clicked off", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(3));
    // Turn off 'system' filter
    const systemFilter = Array.from(document.querySelectorAll(".recorded-modal__rail-filter"))
      .find((b) => b.textContent?.trim() === "system")!;
    fireEvent.click(systemFilter);
    expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(2);
  });

  it("populates outline match counts when the search input changes", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail-input")).not.toBeNull());
    const input = q(".recorded-modal__rail-input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "hello" } });
    await vi.waitFor(() => {
      const matches = document.querySelectorAll(".recorded-modal__outline-match");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("navigates to Benchmark with the messageId when Optimize is clicked", async () => {
    const onClose = vi.fn();
    render(() => <RecordedMessageModal open={true} messageId="msg-42" onClose={onClose} />);
    mockGetMessageDetails.mockResolvedValue(baseDetails({ message: { ...baseDetails().message, id: "msg-42" } }));
    await vi.waitFor(() => expect(findButton("Optimize")).toBeDefined());
    fireEvent.click(findButton("Optimize")!);
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/agents/test-agent/benchmark?optimize=msg-42");
  });

  it("hides Optimize, Copy, Essentials, and the rail when the recording is absent", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({ recording: null, message: { ...baseDetails().message, recorded: false } }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-drawer__tabs")).not.toBeNull());
    expect(findButton("Optimize")).toBeUndefined();
    expect(findButton("Copy request")).toBeUndefined();
    expect(findButton("Copy response")).toBeUndefined();
    expect(q(".recorded-modal__essentials")).toBeNull();
    expect(q(".recorded-modal__rail")).toBeNull();
  });

  it("copies the request JSON via the clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(findButton("Copy request")).toBeDefined());
    fireEvent.click(findButton("Copy request")!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Request copied to clipboard.");
    });
  });

  it("deletes the recording via the overflow menu confirm flow", async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={onClose} onDeleted={onDeleted} />
    ));
    await vi.waitFor(() => expect(q(".recorded-drawer__overflow-btn")).not.toBeNull());
    fireEvent.click(q(".recorded-drawer__overflow-btn") as HTMLElement);
    fireEvent.click(findButton("Delete recording")!);
    await vi.waitFor(() => expect(findButton("Confirm delete")).toBeDefined());
    fireEvent.click(findButton("Confirm delete")!);
    await vi.waitFor(() => {
      expect(mockDeleteMessageRecording).toHaveBeenCalledWith("msg-1");
      expect(onDeleted).toHaveBeenCalledWith("msg-1");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes on Escape and on backdrop click", async () => {
    const onClose = vi.fn();
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={onClose} />);
    await vi.waitFor(() => expect(q(".modal-overlay")).not.toBeNull());
    fireEvent.keyDown(q(".modal-overlay")!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(q(".modal-overlay")!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders streaming response body with raw SSE in the Response tab", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: { messages: [{ role: "user", content: "hi" }] },
          response_body: { type: "stream", raw_sse: "data: chunk\n\n" },
          response_headers: {},
          size_bytes: 10,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(findButton("Response")).toBeDefined());
    fireEvent.click(findButton("Response")!);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Streaming response");
      expect(document.body.textContent).toContain("data: chunk");
    });
  });

  it("shows an empty-state message when no turns match the role filter", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(3));
    for (const role of ["user", "assistant", "system", "tool"]) {
      const f = Array.from(document.querySelectorAll(".recorded-modal__rail-filter"))
        .find((b) => b.textContent?.trim() === role);
      if (f) fireEvent.click(f);
    }
    expect(document.body.textContent).toContain("No turns match the current filters.");
  });
});
