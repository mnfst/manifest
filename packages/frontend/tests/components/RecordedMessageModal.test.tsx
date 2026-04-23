import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

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

vi.mock("../../src/components/CodeBlock.jsx", () => ({
  default: (props: { code: string; language: string }) => (
    <pre data-testid={`code-${props.language}`}>{props.code}</pre>
  ),
}));

import RecordedMessageModal from "../../src/components/RecordedMessageModal";

const q = (sel: string) => document.querySelector(sel);

function baseDetails(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      id: "msg-1",
      timestamp: "2026-02-16 10:00:00",
      model: "gpt-4o",
      request_headers: { "user-agent": "test" },
      recorded: true,
    },
    recording: {
      request_body: { messages: [{ role: "user", content: "hi" }] },
      response_body: { type: "json", body: { choices: [] } },
      response_headers: { "content-type": "application/json" },
      size_bytes: 100,
      created_at: "2026-02-16 10:00:00",
    },
    llm_calls: [],
    tool_executions: [],
    agent_logs: [],
    ...overrides,
  };
}

describe("RecordedMessageModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMessageDetails.mockResolvedValue(baseDetails());
    mockDeleteMessageRecording.mockResolvedValue(undefined);
  });

  it("renders nothing when closed", () => {
    render(() => (
      <RecordedMessageModal open={false} messageId={null} onClose={vi.fn()} />
    ));
    expect(q(".modal-overlay")).toBeNull();
  });

  it("renders a dialog and the recording sections when open", async () => {
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText("Recorded message")).toBeDefined();
      expect(screen.getByText("Request")).toBeDefined();
      expect(screen.getByText("Response")).toBeDefined();
    });
  });

  it("renders empty-state copy when nothing was captured", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: null,
        message: {
          id: "msg-1",
          timestamp: "2026-02-16 10:00:00",
          model: "gpt-4o",
          request_headers: null,
          recorded: false,
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("No headers captured.");
      expect(document.body.textContent).toContain("No request body captured.");
    });
  });

  it("renders streaming response body with raw_sse hint", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {},
          response_body: { type: "stream", raw_sse: "data: chunk\n\n" },
          response_headers: {},
          size_bytes: 10,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        "Streaming response — raw Server-Sent Events below.",
      );
      expect(document.body.textContent).toContain("data: chunk");
    });
  });

  it("closes the modal on Escape and on backdrop click", async () => {
    const onClose = vi.fn();
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={onClose} />
    ));
    await vi.waitFor(() => expect(q(".modal-overlay")).not.toBeNull());
    fireEvent.keyDown(q(".modal-overlay")!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(q(".modal-overlay")!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes the modal from the Close footer button", async () => {
    const onClose = vi.fn();
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={onClose} />
    ));
    await vi.waitFor(() => expect(q(".modal-overlay")).not.toBeNull());
    const closeBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Close",
    )!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("confirms and then deletes the recording via the API", async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    render(() => (
      <RecordedMessageModal
        open={true}
        messageId="msg-1"
        onClose={onClose}
        onDeleted={onDeleted}
      />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText("Delete recording")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Delete recording"));
    await vi.waitFor(() => {
      expect(screen.getByText(/Confirm delete/)).toBeDefined();
    });
    fireEvent.click(screen.getByText("Confirm delete"));
    await vi.waitFor(() => {
      expect(mockDeleteMessageRecording).toHaveBeenCalledWith("msg-1");
      expect(mockToast.success).toHaveBeenCalledWith("Recording deleted.");
      expect(onDeleted).toHaveBeenCalledWith("msg-1");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("cancels delete confirmation without calling the API", async () => {
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText("Delete recording")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Delete recording"));
    await vi.waitFor(() => {
      expect(screen.getByText("Cancel")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockDeleteMessageRecording).not.toHaveBeenCalled();
  });

  it("does not fetch when messageId is null", () => {
    render(() => (
      <RecordedMessageModal open={true} messageId={null} onClose={vi.fn()} />
    ));
    expect(mockGetMessageDetails).not.toHaveBeenCalled();
  });

  it("swallows errors during delete without crashing", async () => {
    const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
    window.addEventListener("unhandledrejection", suppress);
    try {
      mockDeleteMessageRecording.mockRejectedValue(new Error("nope"));
      render(() => (
        <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
      ));
      await vi.waitFor(() => {
        expect(screen.getByText("Delete recording")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Delete recording"));
      await vi.waitFor(() => {
        expect(screen.getByText("Confirm delete")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Confirm delete"));
      await vi.waitFor(() => {
        expect(mockDeleteMessageRecording).toHaveBeenCalled();
      });
    } finally {
      window.removeEventListener("unhandledrejection", suppress);
    }
  });

  it("renders a formatted chat completion request and response", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            model: "gpt-4o",
            stream: false,
            temperature: 0.7,
            max_tokens: 512,
            messages: [
              { role: "system", content: "You are helpful." },
              { role: "user", content: "hi" },
              {
                role: "tool",
                tool_call_id: "call_123",
                name: "search",
                content: [{ type: "text", text: "snippet" }],
              },
            ],
            tools: [{ type: "function", function: { name: "search", description: "web search" } }],
          },
          response_body: {
            type: "json",
            body: {
              id: "chatcmpl-1",
              model: "gpt-4o",
              created: 1_700_000_000,
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: "Hello!",
                    tool_calls: [
                      {
                        id: "call_abc",
                        function: { name: "lookup", arguments: '{"q":"now"}' },
                      },
                    ],
                  },
                  finish_reason: "tool_calls",
                },
                { index: 1, message: { role: "assistant", content: "Alt." }, finish_reason: "stop" },
              ],
              usage: {
                prompt_tokens: 12,
                completion_tokens: 6,
                total_tokens: 18,
                cache_read_tokens: 4,
                cache_creation_tokens: 2,
              },
            },
          },
          response_headers: { "content-type": "application/json" },
          size_bytes: 300,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Parameters");
      expect(document.body.textContent).toContain("Conversation (3)");
      expect(document.body.textContent).toContain("Tools available (1)");
      expect(document.body.textContent).toContain("Hello!");
      expect(document.body.textContent).toContain("Other choices");
      expect(document.body.textContent).toContain("Usage");
      expect(document.body.textContent).toContain("tool_call_id: call_123");
    });
  });

  it("falls back to raw JSON for non-chat response bodies", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: { foo: "bar" },
          response_body: { type: "json", body: { some: "custom" } },
          response_headers: {},
          size_bytes: 10,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      const bodyTitles = Array.from(document.querySelectorAll(".recorded-modal__subtitle"))
        .map((el) => el.textContent)
        .filter((t) => t === "Body");
      expect(bodyTitles.length).toBeGreaterThan(0);
      expect(document.querySelectorAll('[data-testid="code-json"]').length).toBeGreaterThan(0);
    });
  });

  it("renders a multimodal message with text and image parts", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Describe this" },
                  { type: "image_url", image_url: { url: "https://example.com/i.png" } },
                  { type: "image_url", image_url: "https://example.com/direct.png" },
                ],
              },
            ],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Describe this");
      expect(document.body.textContent).toContain("https://example.com/i.png");
      expect(document.body.textContent).toContain("https://example.com/direct.png");
    });
  });

  it("falls back to JSON when a message content is an opaque object", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: { weird: "shape" } }],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      const jsonBlocks = document.querySelectorAll('[data-testid="code-json"]');
      expect(jsonBlocks.length).toBeGreaterThan(0);
    });
  });

  it("renders array parts that carry only text (no type)", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: [{ text: "loose part" }] }],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("loose part");
    });
  });

  it("renders empty content as a muted placeholder", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "assistant", content: null }],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("(empty)");
    });
  });

  it("renders a JSON CodeBlock for array parts with unknown type and no text", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              {
                role: "user",
                content: [{ type: "tool_result", tool_use_id: "tu_1", is_error: false }],
              },
            ],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      // Unknown-type parts fall through to a JSON CodeBlock
      const jsonBlocks = document.querySelectorAll('[data-testid="code-json"]');
      expect(jsonBlocks.length).toBeGreaterThan(0);
      const texts = Array.from(jsonBlocks).map((b) => b.textContent ?? "");
      expect(texts.some((t) => t.includes("tool_result") && t.includes("tu_1"))).toBe(true);
    });
  });

  it("renders tool_calls attached to a non-assistant conversation turn", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              {
                role: "assistant",
                content: "calling tools",
                tool_calls: [
                  {
                    id: "call_turn_1",
                    function: { name: "search_web", arguments: '{"query":"weather"}' },
                  },
                ],
              },
            ],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      // ToolCallsBlock inside ChatTurns should surface the call name
      const turnsBody = document.querySelector(".recorded-modal__turn-body");
      expect(turnsBody).not.toBeNull();
      expect(turnsBody!.textContent).toContain("search_web");
      expect(turnsBody!.textContent).toContain("tool call");
    });
  });

  it("formats non-string tool-call arguments via prettyJson", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              {
                role: "assistant",
                content: "ok",
                tool_calls: [
                  {
                    id: "call_obj",
                    function: {
                      name: "lookup",
                      // object arg (not a string) exercises the prettyJson fallback
                      arguments: { q: "now", limit: 5 },
                    },
                  },
                ],
              },
            ],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      const pre = Array.from(document.querySelectorAll(".recorded-modal__pre--tight"));
      expect(pre.length).toBeGreaterThan(0);
      // JSON.stringify with indent -> should contain keys/values on separate lines
      const text = pre.map((p) => p.textContent ?? "").join("\n");
      expect(text).toContain('"q": "now"');
      expect(text).toContain('"limit": 5');
    });
  });

  it("falls back to String(value) when prettyJson hits a circular reference", async () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [{ role: "user", content: circular }],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      // The catch branch falls back to String(value), which is "[object Object]".
      const blocks = document.querySelectorAll('[data-testid="code-json"]');
      const matched = Array.from(blocks).some(
        (b) => (b.textContent ?? "").includes("[object Object]"),
      );
      expect(matched).toBe(true);
    });
  });

  it("returns the raw string when tool-call arguments are not valid JSON", async () => {
    mockGetMessageDetails.mockResolvedValue(
      baseDetails({
        recording: {
          request_body: {
            messages: [
              {
                role: "assistant",
                content: "ok",
                tool_calls: [
                  {
                    id: "call_bad",
                    function: { name: "lookup", arguments: "not-json-at-all{" },
                  },
                ],
              },
            ],
          },
          response_body: null,
          response_headers: {},
          size_bytes: 0,
          created_at: "",
        },
      }),
    );
    render(() => (
      <RecordedMessageModal open={true} messageId="msg-1" onClose={vi.fn()} />
    ));
    await vi.waitFor(() => {
      const pre = Array.from(document.querySelectorAll(".recorded-modal__pre--tight"));
      const text = pre.map((p) => p.textContent ?? "").join("\n");
      expect(text).toContain("not-json-at-all{");
    });
  });

  // NOTE: the data.error + Retry-button branch is intentionally not covered by
  // a rendering test here. SolidJS's `createResource` rejection path does not
  // settle reliably under jsdom + Vitest: the resource stays stuck in the
  // `loading` state even after the fetcher rejects, so the `<Show when={data.error}>`
  // branch never runs. We tried rejecting on microtasks, macrotasks, and awaiting
  // unhandledrejection events — none flip the resource into the error state in
  // this harness. The `onClick={() => refetch()}` on line 593 has an
  // `/* v8 ignore next */` directive in the source to document this gap.
});
