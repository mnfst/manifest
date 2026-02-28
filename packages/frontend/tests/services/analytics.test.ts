import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockTelemetryOptOut = false;

vi.mock("../../src/services/local-mode.js", () => ({
  telemetryOptOut: () => mockTelemetryOptOut,
}));

const mockFetch = vi.fn();
const mockLocalStorage: Record<string, string> = {};

beforeEach(() => {
  mockTelemetryOptOut = false;
  mockFetch.mockResolvedValue({});
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage[key] = value;
    }),
  });
  vi.stubGlobal("crypto", {
    getRandomValues: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = i;
      }
      return arr;
    }),
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  mockFetch.mockReset();
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
});

describe("trackEvent", () => {
  it("should not call fetch when telemetry is opted out", async () => {
    mockTelemetryOptOut = true;
    const { trackEvent } = await import("../../src/services/analytics.js");

    trackEvent("page_view");

    expect(mockFetch).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });

  it("should send event to PostHog when telemetry is not opted out", async () => {
    const { trackEvent } = await import("../../src/services/analytics.js");

    trackEvent("page_view");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://eu.i.posthog.com/capture");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });

    const body = JSON.parse(options.body);
    expect(body.api_key).toBe("phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045");
    expect(body.event).toBe("page_view");
    expect(body.properties.source).toBe("frontend");
    expect(body.timestamp).toBe("2026-01-15T12:00:00.000Z");
  });

  it("should include custom properties merged with defaults", async () => {
    const { trackEvent } = await import("../../src/services/analytics.js");

    trackEvent("button_click", { button: "submit", page: "settings" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.properties.button).toBe("submit");
    expect(body.properties.page).toBe("settings");
    expect(body.properties.source).toBe("frontend");
    expect(body.properties.distinct_id).toBeDefined();
  });

  it("should work without optional properties argument", async () => {
    const { trackEvent } = await import("../../src/services/analytics.js");

    trackEvent("simple_event");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.event).toBe("simple_event");
    expect(body.properties.source).toBe("frontend");
    expect(body.properties.distinct_id).toBeDefined();
  });

  it("should silently swallow fetch errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { trackEvent } = await import("../../src/services/analytics.js");

    // Should not throw
    expect(() => trackEvent("test_event")).not.toThrow();
  });
});

describe("getAnonymousId (via trackEvent)", () => {
  it("should generate a new ID and store it when none exists", async () => {
    const { trackEvent } = await import("../../src/services/analytics.js");

    trackEvent("test_event");

    expect(localStorage.getItem).toHaveBeenCalledWith("mnfst_anon_id");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "mnfst_anon_id",
      expect.any(String),
    );

    // Verify the generated ID is a 32-char hex string based on our mock
    const storedId = (localStorage.setItem as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as string;
    expect(storedId).toMatch(/^[0-9a-f]{32}$/);
    // With our mock (bytes 0-15), the expected hex is:
    expect(storedId).toBe("000102030405060708090a0b0c0d0e0f");
  });

  it("should reuse existing ID from localStorage", async () => {
    mockLocalStorage["mnfst_anon_id"] = "existing-anon-id-abc123";
    const { trackEvent } = await import("../../src/services/analytics.js");

    trackEvent("test_event");

    expect(localStorage.getItem).toHaveBeenCalledWith("mnfst_anon_id");
    expect(localStorage.setItem).not.toHaveBeenCalled();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.properties.distinct_id).toBe("existing-anon-id-abc123");
  });

  it("should use the generated ID as distinct_id in the payload", async () => {
    const { trackEvent } = await import("../../src/services/analytics.js");

    trackEvent("test_event");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.properties.distinct_id).toBe(
      "000102030405060708090a0b0c0d0e0f",
    );
  });
});
