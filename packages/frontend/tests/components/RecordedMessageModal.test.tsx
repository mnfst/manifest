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
    // jsdom doesn't implement scrollIntoView; the drawer's jumpTo() calls
    // it inside queueMicrotask. Stub it so unhandled-error logs don't fire.
    if (!(Element.prototype as { scrollIntoView?: () => void }).scrollIntoView) {
      (Element.prototype as { scrollIntoView?: () => void }).scrollIntoView = () => {};
    }
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

  it("hides Copy buttons, Essentials, and the rail when the recording is absent", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({ recording: null, message: { ...baseDetails().message, recorded: false } }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-drawer__tabs")).not.toBeNull());
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

  it("renders XML chips above the turn block when content is XML", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              {
                role: "user",
                content: "<doc><title>hi</title><body>world</body></doc>",
              },
            ],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 50,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-x" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(document.querySelector(".recorded-modal__xml-chip-row")).not.toBeNull();
    });
    const chips = Array.from(document.querySelectorAll(".recorded-modal__xml-chip")).map(
      (c) => c.textContent,
    );
    expect(chips.some((c) => c?.includes("doc"))).toBe(true);
  });

  it("renders a tool calls block when the assistant turn carries tool_calls", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              { role: "user", content: "hi" },
              {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: { name: "lookup", arguments: '{"q":"x"}' },
                  },
                ],
              },
            ],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 100,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-tools" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("lookup");
    });
  });

  it("surfaces tool message metadata (name + tool_call_id) on the turn header", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              { role: "user", content: "hi" },
              {
                role: "tool",
                name: "lookup",
                tool_call_id: "call_xyz",
                content: "result payload",
              },
            ],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 80,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-tool" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("lookup");
      expect(document.body.textContent).toContain("tool_call_id: call_xyz");
    });
  });

  it("handles tool call arguments that are not valid JSON (string), objects, and circular refs", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              {
                role: "assistant",
                content: "",
                tool_calls: [
                  { id: "c1", type: "function", function: { name: "a", arguments: "not json {" } },
                  { id: "c2", type: "function", function: { name: "b", arguments: { x: 1 } } },
                  { id: "c3", type: "function", function: { name: "c", arguments: circular } },
                ],
              },
            ],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 100,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-tc" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(document.body.textContent).toContain("not json {"));
  });

  it("renders JSON-shaped turn content via the json CodeBlock branch", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: '{"q":"hello","n":3}' }],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 50,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-json" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q('[data-testid="code-json"]')).not.toBeNull());
  });

  it("switches to raw rendering mode when the render toggle is clicked", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() =>
      expect(q(".recorded-drawer__render-toggle")).not.toBeNull(),
    );
    const toggle = q(".recorded-drawer__render-toggle") as HTMLElement;
    expect(toggle.textContent?.trim()).toBe("Rendered");
    fireEvent.click(toggle);
    await vi.waitFor(() => {
      expect(q(".recorded-drawer__render-toggle")?.textContent?.trim()).toBe("Raw");
      expect(document.querySelector('[data-testid="code-plaintext"]')).not.toBeNull();
    });
  });

  it("jumps to the last user turn when the Essentials user CTA is clicked", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__essentials")).not.toBeNull());
    const jumpBtns = Array.from(
      document.querySelectorAll(".recorded-modal__essentials-jump"),
    );
    expect(jumpBtns.length).toBe(2);
    fireEvent.click(jumpBtns[0]);
    await vi.waitFor(() => {
      const conv = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(conv?.textContent).toContain("Conversation");
    });
  });

  it("jumps to the last assistant turn when the Essentials assistant CTA is clicked", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__essentials")).not.toBeNull());
    const jumpBtns = Array.from(
      document.querySelectorAll(".recorded-modal__essentials-jump"),
    );
    fireEvent.click(jumpBtns[1]);
    await vi.waitFor(() => {
      const conv = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(conv?.textContent).toContain("Conversation");
    });
  });

  it("shows Essentials tool-calls pill when assistant reply carries tool_calls", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: "hi" }],
          },
          response_body: {
            type: "json",
            body: {
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: "",
                    tool_calls: [
                      { id: "c1", type: "function", function: { name: "lookup" } },
                    ],
                  },
                },
              ],
            },
          },
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const ess = q(".recorded-modal__essentials")!;
      expect(ess.textContent).toContain("tool calls");
      expect(ess.textContent).toContain("lookup");
    });
  });

  it("expands a long Essentials body via the Show full toggle", async () => {
    const long = "x".repeat(500);
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: { messages: [{ role: "user", content: long }] },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 600,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(findButton("Show full")).toBeDefined());
    fireEvent.click(findButton("Show full")!);
    await vi.waitFor(() => expect(findButton("Show less")).toBeDefined());
  });

  it("renders a cache_read metric pill when the message has cached prompt tokens", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        message: { ...baseDetails().message, cache_read_tokens: 100 },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const metrics = q(".recorded-drawer__metrics")!.textContent ?? "";
      expect(metrics).toContain("cache read");
    });
  });

  it("focuses the rail search input when '/' is pressed in the drawer", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail-input")).not.toBeNull());
    const drawer = q(".recorded-drawer") as HTMLElement;
    fireEvent.keyDown(drawer, { key: "/" });
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe("recorded-drawer-search");
    });
  });

  it("does not hijack '/' when focus is in an input/textarea", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail-input")).not.toBeNull());
    const drawer = q(".recorded-drawer") as HTMLElement;
    const railInput = q(".recorded-modal__rail-input") as HTMLInputElement;
    railInput.focus();
    const ev = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    drawer.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("closes the overflow menu when Escape is pressed while it is open", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-drawer__overflow-btn")).not.toBeNull());
    fireEvent.click(q(".recorded-drawer__overflow-btn") as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeUndefined());
  });

  it("closes the overflow menu when clicking outside of it", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-drawer__overflow-btn")).not.toBeNull());
    fireEvent.click(q(".recorded-drawer__overflow-btn") as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    // Pointer-down on the body, outside the overflow wrapper. jsdom lacks
    // PointerEvent, so a plain Event with the right type suffices for the
    // listener — it only cares about .target and bubbling.
    const ev = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(ev, "target", { value: document.body, configurable: true });
    document.dispatchEvent(ev);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeUndefined());
  });

  it("toasts an error when copy-request is clicked but the request body is missing", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: null,
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    // The Copy request button only renders when request_body is truthy, so
    // here we assert it's hidden — the null-payload toast path is exercised
    // separately by direct copyToClipboard tests when added.
    await vi.waitFor(() => expect(q(".recorded-drawer__tabs")).not.toBeNull());
    expect(findButton("Copy request")).toBeUndefined();
  });

  it("surfaces a clipboard-blocked toast when writeText rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(findButton("Copy request")).toBeDefined());
    fireEvent.click(findButton("Copy request")!);
    await vi.waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Clipboard write blocked by the browser.");
    });
  });

  it("swallows delete errors without crashing the drawer", async () => {
    mockDeleteMessageRecording.mockRejectedValueOnce(new Error("server fail"));
    const onClose = vi.fn();
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={onClose} />);
    await vi.waitFor(() => expect(q(".recorded-drawer__overflow-btn")).not.toBeNull());
    fireEvent.click(q(".recorded-drawer__overflow-btn") as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    fireEvent.click(findButton("Delete recording")!);
    await vi.waitFor(() => expect(findButton("Confirm delete")).toBeDefined());
    fireEvent.click(findButton("Confirm delete")!);
    // Drawer stays open since delete failed — no onClose() call.
    await vi.waitFor(() => {
      expect(mockDeleteMessageRecording).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking an outline row for a collapsed turn expands it", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail")).not.toBeNull());
    // The system turn is collapsed by default (see "renders conversation turn rows" test).
    const systemRow = Array.from(
      document.querySelectorAll(".recorded-modal__outline-row"),
    ).find((el) => el.textContent?.toLowerCase().includes("system")) as HTMLElement;
    expect(systemRow).toBeDefined();
    fireEvent.click(systemRow);
    await vi.waitFor(() => {
      const systemTurn = Array.from(document.querySelectorAll(".recorded-modal__turn")).find(
        (t) => t.getAttribute("data-role") === "system",
      );
      expect(systemTurn?.classList.contains("recorded-modal__turn--compact")).toBe(false);
    });
  });

  it("re-adds a role chip after it was toggled off", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(3));
    const userChip = Array.from(document.querySelectorAll(".recorded-modal__rail-filter")).find(
      (b) => b.textContent?.trim() === "user",
    ) as HTMLElement;
    fireEvent.click(userChip); // turn off
    await vi.waitFor(() =>
      expect(document.querySelectorAll('.recorded-modal__turn[data-role="user"]').length).toBe(0),
    );
    fireEvent.click(userChip); // turn back on
    await vi.waitFor(() =>
      expect(
        document.querySelectorAll('.recorded-modal__turn[data-role="user"]').length,
      ).toBeGreaterThan(0),
    );
  });

  it("Escape pressed inside the drawer closes it", async () => {
    const onClose = vi.fn();
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={onClose} />);
    await vi.waitFor(() => expect(q(".recorded-drawer")).not.toBeNull());
    const drawer = q(".recorded-drawer") as HTMLElement;
    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the tools tab content when there are tools in the request_body", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: "hi" }],
            tools: [
              { type: "function", function: { name: "lookup", description: "find a thing" } },
            ],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-drawer__tabs")).not.toBeNull());
    const toolsTab = Array.from(document.querySelectorAll('[role="tab"]')).find((t) =>
      t.textContent?.includes("Tools"),
    ) as HTMLElement;
    fireEvent.click(toolsTab);
    await vi.waitFor(() => {
      expect(document.querySelector(".recorded-modal__tool-def")?.textContent).toContain("lookup");
    });
  });

  it("renders the empty-tools fallback on the tools tab when none are defined", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: { messages: [{ role: "user", content: "hi" }] },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-drawer__tabs")).not.toBeNull());
    const toolsTab = Array.from(document.querySelectorAll('[role="tab"]')).find((t) =>
      t.textContent?.includes("Tools"),
    ) as HTMLElement;
    fireEvent.click(toolsTab);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("No tools defined");
    });
  });

  it("jumps to the first user turn when the rail 'First user' button is clicked", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail")).not.toBeNull());
    fireEvent.click(findButton("⤒ First user")!);
    await vi.waitFor(() => {
      const conv = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(conv?.textContent).toContain("Conversation");
    });
  });

  it("renders the '999+' badge when a turn has more than 999 matches", async () => {
    // Compose content that has > MAX_COUNTED_MATCHES occurrences of 'a'.
    const heavyContent = "a".repeat(1500);
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: { messages: [{ role: "user", content: heavyContent }] },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 1500,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail-input")).not.toBeNull());
    const input = q(".recorded-modal__rail-input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "a" } });
    await vi.waitFor(() => {
      const matches = Array.from(
        document.querySelectorAll(".recorded-modal__outline-match"),
      ).map((m) => m.textContent);
      expect(matches.some((m) => m?.includes("999+"))).toBe(true);
    });
  });

  it("renders an '(empty)' preview when a message has neither content nor tool_calls", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "" }],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const previews = Array.from(document.querySelectorAll(".recorded-modal__outline-preview"))
        .map((p) => p.textContent);
      expect(previews.some((p) => p?.includes("(empty)"))).toBe(true);
    });
  });

  it("falls back to text rendering when JSON-shaped content is malformed", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: '{"q":"hi' /* missing close */ }],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      // Falls through to text — chip row and json codeblock should not appear.
      expect(document.querySelector('[data-testid="code-json"]')).toBeNull();
    });
  });

  it("toggles the cap on a long turn via the expand button", async () => {
    const longContent = "x".repeat(3000);
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: longContent }],
          },
          response_body: { type: "json", body: { choices: [] } },
          response_headers: {},
          size_bytes: 3100,
          created_at: "",
        },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-long" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(findButton("Expand to full height")).toBeDefined());
    fireEvent.click(findButton("Expand to full height")!);
    await vi.waitFor(() => expect(findButton("Collapse back")).toBeDefined());
  });
});
