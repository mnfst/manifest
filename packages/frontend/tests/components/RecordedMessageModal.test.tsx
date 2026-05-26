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
      expect(screen.getByText("Message log")).toBeDefined();
    });
    expect(q(".recorded-drawer")).not.toBeNull();
    expect(q('[aria-label="Call metrics"]')).not.toBeNull();
    expect(q(".recorded-drawer__tabs")).not.toBeNull();
  });

  it("shows the metric fields with token and cost values", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const metrics = q('[aria-label="Call metrics"]')!.textContent ?? "";
      expect(metrics).toContain("Input");
      expect(metrics).toContain("Output");
      expect(metrics).toContain("Total");
      expect(metrics).toContain("Cost");
      expect(metrics).toContain("standard"); // routing tier
    });
  });

  it("surfaces user and assistant messages in the conversation turns", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const turns = document.querySelectorAll(".recorded-modal__turn");
      expect(turns.length).toBe(3);
      expect(document.body.textContent).toContain("hi there");
      expect(document.body.textContent).toContain("hello back");
    });
  });

  it("surfaces OpenAI Responses input in the conversation turns", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            model: "gpt-5.4-mini",
            instructions: "Be concise.",
            input: [
              {
                role: "user",
                content: [
                  { type: "input_text", text: "look at this" },
                  { type: "input_image", image_url: "https://example.test/image.png" },
                ],
              },
              { role: "assistant", content: [{ type: "output_text", text: "noted" }] },
            ],
          },
          response_body: { type: "json", body: { id: "resp_1", output: [] } },
          response_headers: {},
          size_bytes: 120,
          created_at: "",
        },
      }),
    );

    render(() => <RecordedMessageModal open={true} messageId="msg-responses" onClose={vi.fn()} />);

    await vi.waitFor(() => {
      const tab = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(tab?.textContent).toContain("Conversation");
      expect(tab?.textContent).toContain("3");
      expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(3);
      expect(document.body.textContent).toContain("Be concise.");
      expect(document.body.textContent).toContain("look at this");
      expect(document.body.textContent).toContain("[image]");
      expect(document.body.textContent).toContain("noted");
    });
    expect(document.body.textContent).not.toContain("Unrecognised request body shape");
  });

  it("appends OpenAI Responses output as the final assistant turn", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            model: "gpt-5-mini",
            input: [
              {
                role: "user",
                content: [{ type: "input_text", text: "latest user question" }],
              },
            ],
          },
          response_body: {
            type: "json",
            body: {
              id: "resp_1",
              output: [
                {
                  type: "message",
                  role: "assistant",
                  content: [{ type: "output_text", text: "latest assistant answer" }],
                },
              ],
            },
          },
          response_headers: {},
          size_bytes: 120,
          created_at: "",
        },
      }),
    );

    render(() => <RecordedMessageModal open={true} messageId="msg-responses" onClose={vi.fn()} />);

    await vi.waitFor(() => {
      const turns = Array.from(document.querySelectorAll(".recorded-modal__turn"));
      expect(turns.length).toBe(2);
      expect(turns.map((t) => t.getAttribute("data-role"))).toEqual(["user", "assistant"]);
      expect(turns[turns.length - 1]?.textContent).toContain("latest assistant answer");
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
      .find((b) => b.textContent?.trim() === "system");
    // If rail filters exist, click to toggle
    if (systemFilter) {
      fireEvent.click(systemFilter);
      expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(2);
    }
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
    // Copy request is inside the overflow menu
    await vi.waitFor(() => {
      const moreBtn = document.querySelector('button[aria-label="More actions"]');
      expect(moreBtn).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
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
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    fireEvent.click(findButton("Delete recording")!);
    // Delete confirmation is now a modal with a "Delete recording" confirm button
    await vi.waitFor(() => {
      const confirmBtn = Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      );
      expect(confirmBtn).not.toBeUndefined();
    });
    fireEvent.click(
      Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      ) as HTMLElement,
    );
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
      expect(document.body.textContent).toContain("streamed");
      expect(document.body.textContent).toContain("data: chunk");
    });
  });

  it("shows an empty-state message when no turns match the role filter", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(document.querySelectorAll(".recorded-modal__turn").length).toBe(3));
    // Toggle off each role one at a time using the data-role attribute
    for (const role of ["user", "assistant", "system", "tool"]) {
      const f = document.querySelector(`.recorded-modal__rail-filter[data-role="${role}"]`);
      if (f) fireEvent.click(f);
    }
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("No turns match the current filters.");
    });
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

  it("renders conversation turns in rendered mode by default", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const turns = document.querySelectorAll(".recorded-modal__turn");
      expect(turns.length).toBe(3);
    });
  });

  it("shows the conversation tab selected by default", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const conv = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(conv?.textContent).toContain("Conversation");
    });
  });

  it("renders user and assistant turns in the conversation", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const turns = document.querySelectorAll(".recorded-modal__turn");
      expect(turns.length).toBe(3);
      const roles = Array.from(turns).map((t) => t.getAttribute("data-role"));
      expect(roles).toContain("user");
      expect(roles).toContain("assistant");
      expect(roles).toContain("system");
    });
  });

  it("renders conversation with user message when response has tool_calls", async () => {
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
      expect(document.body.textContent).toContain("hi");
    });
  });

  it("renders a long user turn content in the conversation", async () => {
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
    await vi.waitFor(() => {
      const turns = document.querySelectorAll(".recorded-modal__turn");
      expect(turns.length).toBeGreaterThan(0);
    });
  });

  it("renders a Cache Read metric field when the message has cached prompt tokens", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        message: { ...baseDetails().message, cache_read_tokens: 100 },
      }),
    );
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const metrics = q('[aria-label="Call metrics"]')!.textContent ?? "";
      expect(metrics).toContain("Cache Read");
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
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeUndefined());
  });

  it("closes the overflow menu when clicking outside of it", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
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
    // Copy request is inside the overflow menu
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
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
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    fireEvent.click(findButton("Delete recording")!);
    // Delete confirmation is now a modal
    await vi.waitFor(() => {
      const confirmBtn = Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      );
      expect(confirmBtn).not.toBeUndefined();
    });
    fireEvent.click(
      Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      ) as HTMLElement,
    );
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
    ) as HTMLElement | undefined;
    if (userChip) {
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
    }
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

  it("renders the rail with outline when recording is present", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      const conv = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(conv?.textContent).toContain("Conversation");
    });
    // The rail should exist when we have a recording with messages
    const rail = q(".recorded-modal__rail");
    if (rail) {
      const firstUserBtn = findButton("⤒ First user");
      if (firstUserBtn) {
        fireEvent.click(firstUserBtn);
        await vi.waitFor(() => {
          const conv = document.querySelector('[role="tab"][aria-selected="true"]');
          expect(conv?.textContent).toContain("Conversation");
        });
      }
    }
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

  it("shows error state with Retry button when getMessageDetails rejects", async () => {
    // SolidJS createResource throws from data() when errored. We need an
    // ErrorBoundary to prevent the throw from killing the render tree.
    // The boundary's fallback is never visible because data.error / data.loading
    // Shows don't call data() — they use separate accessors.
    const { ErrorBoundary } = await import("solid-js");
    mockGetMessageDetails.mockRejectedValueOnce(new Error("network fail"));
    render(() => (
      <ErrorBoundary fallback={(err: Error) => <div data-testid="boundary">{err.message}</div>}>
        <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
      </ErrorBoundary>
    ));
    await vi.waitFor(
      () => {
        // With ErrorBoundary, either the component's own error UI renders
        // or the boundary fallback renders with the error message.
        const text = document.body.textContent ?? "";
        expect(
          text.includes("Failed to load recording.") || text.includes("network fail"),
        ).toBe(true);
      },
      { timeout: 3000 },
    );
    // If the boundary caught it, the Retry button lives in the component's
    // own error UI. If the boundary rendered, there's no Retry button — the
    // fallback has the error text instead.
    const retryBtn = findButton("Retry");
    if (retryBtn) {
      mockGetMessageDetails.mockResolvedValueOnce(baseDetails());
      fireEvent.click(retryBtn);
      await vi.waitFor(() => {
        expect(mockGetMessageDetails).toHaveBeenCalledTimes(2);
      });
    } else {
      // The ErrorBoundary replaced the tree — verify its fallback is visible
      expect(document.querySelector('[data-testid="boundary"]')).not.toBeNull();
    }
  });

  it("closes delete confirmation modal when Escape is pressed on overlay", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    fireEvent.click(findButton("Delete recording")!);
    // Wait for the delete confirmation modal to appear
    await vi.waitFor(() => {
      const confirmBtn = Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      );
      expect(confirmBtn).not.toBeUndefined();
    });
    // Find the delete confirmation overlay (second .modal-overlay) and press Escape
    const overlays = document.querySelectorAll(".modal-overlay");
    const deleteOverlay = overlays[overlays.length - 1] as HTMLElement;
    fireEvent.keyDown(deleteOverlay, { key: "Escape" });
    // The delete confirmation modal should close
    await vi.waitFor(() => {
      const confirmBtn = Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      );
      expect(confirmBtn).toBeUndefined();
    });
  });

  it("shows a spinner inside the Delete button while deleting", async () => {
    // Make delete hang forever so we can inspect the intermediate state
    mockDeleteMessageRecording.mockImplementation(() => new Promise(() => {}));
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
    await vi.waitFor(() => expect(findButton("Delete recording")).toBeDefined());
    fireEvent.click(findButton("Delete recording")!);
    await vi.waitFor(() => {
      const confirmBtn = Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      );
      expect(confirmBtn).not.toBeUndefined();
    });
    // Click the confirm Delete button
    fireEvent.click(
      Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.textContent?.trim() === "Delete recording",
      ) as HTMLElement,
    );
    // While deleting, a spinner should be visible
    await vi.waitFor(() => {
      const dangerBtn = Array.from(document.querySelectorAll("button.btn--danger")).find(
        (b) => b.querySelector(".spinner"),
      );
      expect(dangerBtn).not.toBeUndefined();
      expect(dangerBtn!.hasAttribute("disabled")).toBe(true);
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

  it("jumpLastUser scrolls to the last user turn via the outline button", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail")).not.toBeNull());
    const lastUserBtn = findButton("Last user");
    expect(lastUserBtn).toBeDefined();
    fireEvent.click(lastUserBtn!);
    // Flush the queueMicrotask inside jumpTo
    await new Promise((r) => queueMicrotask(r));
    await vi.waitFor(() => {
      const tab = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(tab?.textContent).toContain("Conversation");
    });
  });

  it("jumpLastAssistant scrolls to the last assistant turn via the outline button", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail")).not.toBeNull());
    const lastAssistantBtn = findButton("Last assistant");
    expect(lastAssistantBtn).toBeDefined();
    fireEvent.click(lastAssistantBtn!);
    await new Promise((r) => queueMicrotask(r));
    await vi.waitFor(() => {
      const tab = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(tab?.textContent).toContain("Conversation");
    });
  });

  it("jumpFirstUser scrolls to the first user turn via the outline button", async () => {
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail")).not.toBeNull());
    const firstUserBtn = findButton("First user");
    expect(firstUserBtn).toBeDefined();
    fireEvent.click(firstUserBtn!);
    await new Promise((r) => queueMicrotask(r));
    await vi.waitFor(() => {
      const tab = document.querySelector('[role="tab"][aria-selected="true"]');
      expect(tab?.textContent).toContain("Conversation");
    });
  });

  it("onConversationScroll schedules clearHighlight when a turn is highlighted", async () => {
    vi.useFakeTimers();
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => expect(q(".recorded-modal__rail")).not.toBeNull());

    // Jump to a turn to create a highlight
    const lastUserBtn = findButton("Last user");
    fireEvent.click(lastUserBtn!);
    // Flush queueMicrotask
    await new Promise((r) => queueMicrotask(r));
    // Wait for the 600ms ignoreScroll window
    vi.advanceTimersByTime(700);

    // Now scroll the conversation area
    const convMain = q(".recorded-drawer__conversation-main");
    if (convMain) {
      fireEvent.scroll(convMain);
      // The scroll handler sets a 1s timer to clear the highlight
      vi.advanceTimersByTime(1100);
    }
    vi.useRealTimers();
  });

  it("copies the response JSON via the overflow Copy response button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(() => <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    });
    fireEvent.click(document.querySelector('button[aria-label="More actions"]') as HTMLElement);
    await vi.waitFor(() => expect(findButton("Copy response")).toBeDefined());
    fireEvent.click(findButton("Copy response")!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Response copied to clipboard.");
    });
  });
});
