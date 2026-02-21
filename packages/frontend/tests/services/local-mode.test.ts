import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock solid-js signals
let signalValue: boolean | null = null;
const mockSetIsLocalMode = vi.fn((v: boolean | null) => { signalValue = v; });

vi.mock("solid-js", () => ({
  createSignal: (init: boolean | null) => {
    signalValue = init;
    return [() => signalValue, mockSetIsLocalMode];
  },
}));

describe("local-mode", () => {
  beforeEach(() => {
    vi.resetModules();
    signalValue = null;
    mockSetIsLocalMode.mockClear();
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
});
