import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("sse", () => {
  let mockEventSource: any;

  function getHandler(type: string) {
    return mockEventSource.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === type,
    )?.[1];
  }

  beforeEach(() => {
    mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal("EventSource", vi.fn(() => mockEventSource));
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("bumps pingCount immediately but debounces messagePing on legacy 'ping'", async () => {
    vi.useFakeTimers();
    const { connectSse, pingCount, messagePing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const pingHandler = getHandler("ping");
    expect(pingHandler).toBeDefined();
    const beforePing = pingCount();
    const beforeMessage = messagePing();
    pingHandler();
    // pingCount is the legacy counter — bumped synchronously.
    expect(pingCount()).toBe(beforePing + 1);
    // messagePing is coalesced — nothing until the 500ms window elapses.
    expect(messagePing()).toBe(beforeMessage);
    vi.advanceTimersByTime(500);
    expect(messagePing()).toBe(beforeMessage + 1);
  });

  it("bumps pingCount immediately but debounces messagePing on 'message'", async () => {
    vi.useFakeTimers();
    const { connectSse, pingCount, messagePing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const handler = getHandler("message");
    expect(handler).toBeDefined();
    const beforePing = pingCount();
    const beforeMessage = messagePing();
    handler();
    expect(pingCount()).toBe(beforePing + 1);
    expect(messagePing()).toBe(beforeMessage);
    vi.advanceTimersByTime(500);
    expect(messagePing()).toBe(beforeMessage + 1);
  });

  it("coalesces a burst of 'message' events into a single bump per window", async () => {
    vi.useFakeTimers();
    const { connectSse, messagePing } = await import("../../src/services/sse");
    connectSse();
    const handler = getHandler("message");
    const before = messagePing();
    // Five events inside 100ms collapse into one scheduled bump.
    for (let i = 0; i < 5; i++) handler();
    vi.advanceTimersByTime(100);
    expect(messagePing()).toBe(before);
    vi.advanceTimersByTime(400);
    expect(messagePing()).toBe(before + 1);
    // A later event opens a fresh window.
    handler();
    vi.advanceTimersByTime(500);
    expect(messagePing()).toBe(before + 2);
  });

  it("clears the pending message bump timer on cleanup", async () => {
    vi.useFakeTimers();
    const { connectSse, messagePing } = await import("../../src/services/sse");
    const cleanup = connectSse();
    const handler = getHandler("message");
    const before = messagePing();
    handler();
    cleanup();
    vi.advanceTimersByTime(1000);
    // The scheduled bump must not fire after cleanup.
    expect(messagePing()).toBe(before);
    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it("increments agentPing AND pingCount on 'agent' event without touching messagePing", async () => {
    vi.useFakeTimers();
    const { connectSse, pingCount, agentPing, messagePing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const handler = getHandler("agent");
    expect(handler).toBeDefined();
    const beforePing = pingCount();
    const beforeAgent = agentPing();
    const beforeMessage = messagePing();
    handler();
    expect(agentPing()).toBe(beforeAgent + 1);
    expect(pingCount()).toBe(beforePing + 1);
    // 'agent' must NOT schedule a messagePing bump.
    vi.advanceTimersByTime(500);
    expect(messagePing()).toBe(beforeMessage);
  });

  it("increments routingPing AND pingCount on 'routing' event", async () => {
    const { connectSse, pingCount, routingPing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const handler = getHandler("routing");
    expect(handler).toBeDefined();
    const beforePing = pingCount();
    const beforeRouting = routingPing();
    handler();
    expect(routingPing()).toBe(beforeRouting + 1);
    expect(pingCount()).toBe(beforePing + 1);
  });
});
