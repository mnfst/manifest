import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sse", () => {
  let mockEventSource: any;

  beforeEach(() => {
    mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal("EventSource", vi.fn(() => mockEventSource));
  });

  it("creates EventSource with correct URL", async () => {
    const { connectSse } = await import("../../src/services/sse");
    connectSse();
    expect(EventSource).toHaveBeenCalledWith("/api/v1/events");
  });

  it("returns a cleanup function that closes the connection", async () => {
    const { connectSse } = await import("../../src/services/sse");
    const cleanup = connectSse();
    cleanup();
    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it("increments pingCount when ping event is received", async () => {
    const { connectSse, pingCount } = await import("../../src/services/sse");
    connectSse();
    // Get the 'ping' event handler that was registered
    const pingHandler = mockEventSource.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === "ping",
    )?.[1];
    expect(pingHandler).toBeDefined();
    const before = pingCount();
    pingHandler();
    expect(pingCount()).toBe(before + 1);
  });
});
