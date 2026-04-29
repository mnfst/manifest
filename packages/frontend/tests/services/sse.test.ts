import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sse", () => {
  let mockEventSource: any;

  beforeEach(() => {
    mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal("EventSource", vi.fn(() => mockEventSource));
    vi.resetModules();
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

  it("increments pingCount AND messagePing when legacy 'ping' event is received", async () => {
    const { connectSse, pingCount, messagePing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const pingHandler = mockEventSource.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === "ping",
    )?.[1];
    expect(pingHandler).toBeDefined();
    const beforePing = pingCount();
    const beforeMessage = messagePing();
    pingHandler();
    expect(pingCount()).toBe(beforePing + 1);
    // legacy ping is treated as a message-class change so MessageLog/Overview
    // stay reactive when talking to an older backend.
    expect(messagePing()).toBe(beforeMessage + 1);
  });

  it("increments messagePing AND pingCount on 'message' event", async () => {
    const { connectSse, pingCount, messagePing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const handler = mockEventSource.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === "message",
    )?.[1];
    expect(handler).toBeDefined();
    const beforePing = pingCount();
    const beforeMessage = messagePing();
    handler();
    expect(messagePing()).toBe(beforeMessage + 1);
    expect(pingCount()).toBe(beforePing + 1);
  });

  it("increments agentPing AND pingCount on 'agent' event", async () => {
    const { connectSse, pingCount, agentPing, messagePing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const handler = mockEventSource.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === "agent",
    )?.[1];
    expect(handler).toBeDefined();
    const beforePing = pingCount();
    const beforeAgent = agentPing();
    const beforeMessage = messagePing();
    handler();
    expect(agentPing()).toBe(beforeAgent + 1);
    expect(pingCount()).toBe(beforePing + 1);
    // 'agent' event must NOT bump messagePing
    expect(messagePing()).toBe(beforeMessage);
  });

  it("increments routingPing AND pingCount on 'routing' event", async () => {
    const { connectSse, pingCount, routingPing } = await import(
      "../../src/services/sse"
    );
    connectSse();
    const handler = mockEventSource.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === "routing",
    )?.[1];
    expect(handler).toBeDefined();
    const beforePing = pingCount();
    const beforeRouting = routingPing();
    handler();
    expect(routingPing()).toBe(beforeRouting + 1);
    expect(pingCount()).toBe(beforePing + 1);
  });
});
