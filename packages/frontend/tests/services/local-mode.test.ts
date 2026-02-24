import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock solid-js signals — each createSignal call gets its own isolated state
const signalStates: { value: unknown }[] = [];

vi.mock("solid-js", () => ({
  createSignal: (init: unknown) => {
    const state = { value: init };
    signalStates.push(state);
    return [() => state.value, (v: unknown) => { state.value = v; }];
  },
}));

describe("local-mode", () => {
  beforeEach(() => {
    vi.resetModules();
    signalStates.length = 0;
    global.fetch = vi.fn();
  });

  it("returns true when health endpoint reports local mode", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ mode: "local" }),
    });

    const { checkLocalMode } = await import("../../src/services/local-mode.js");
    const result = await checkLocalMode();

    expect(result).toBe(true);
  });

  it("returns false when health endpoint reports cloud mode", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ mode: "cloud" }),
    });

    const { checkLocalMode } = await import("../../src/services/local-mode.js");
    const result = await checkLocalMode();

    expect(result).toBe(false);
  });

  it("returns false when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    const { checkLocalMode } = await import("../../src/services/local-mode.js");
    const result = await checkLocalMode();

    expect(result).toBe(false);
  });

  it("caches the result after first call", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ mode: "local" }),
    });

    const { checkLocalMode } = await import("../../src/services/local-mode.js");
    await checkLocalMode();
    await checkLocalMode();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("exposes telemetryOptOut from health response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ mode: "local", telemetryOptOut: true }),
    });

    const { checkLocalMode, telemetryOptOut } = await import("../../src/services/local-mode.js");
    await checkLocalMode();

    expect(telemetryOptOut()).toBe(true);
  });

  it("defaults telemetryOptOut to false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ mode: "cloud" }),
    });

    const { checkLocalMode, telemetryOptOut } = await import("../../src/services/local-mode.js");
    await checkLocalMode();

    expect(telemetryOptOut()).toBe(false);
  });
});
