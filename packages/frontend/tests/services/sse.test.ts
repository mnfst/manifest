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
});
