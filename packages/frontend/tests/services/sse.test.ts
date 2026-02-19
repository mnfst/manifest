import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let listeners: Record<string, Function>;
let mockClose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  listeners = {};
  mockClose = vi.fn();

  vi.stubGlobal(
    "EventSource",
    vi.fn().mockImplementation(() => ({
      addEventListener: (event: string, cb: Function) => {
        listeners[event] = cb;
      },
      close: mockClose,
    })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("sse", () => {
  it("increments pingCount on ping events", async () => {
    const { pingCount, connectSse } = await import("../../src/services/sse.js");

    expect(pingCount()).toBe(0);

    connectSse();
    listeners["ping"]();
    expect(pingCount()).toBe(1);

    listeners["ping"]();
    expect(pingCount()).toBe(2);
  });

  it("creates EventSource with correct URL", async () => {
    const { connectSse } = await import("../../src/services/sse.js");
    connectSse();

    expect(EventSource).toHaveBeenCalledWith("/api/v1/events");
  });

  it("returns a cleanup function that closes the EventSource", async () => {
    const { connectSse } = await import("../../src/services/sse.js");
    const cleanup = connectSse();

    cleanup();
    expect(mockClose).toHaveBeenCalled();
  });
});
