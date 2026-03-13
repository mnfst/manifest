jest.mock("../src/telemetry-config", () => ({
  getTelemetryConfig: jest.fn(),
}));

import { trackPluginEvent, identifyUser, getMachineId } from "../src/product-telemetry";
import { getTelemetryConfig } from "../src/telemetry-config";

const mockGetTelemetryConfig = getTelemetryConfig as jest.Mock;

describe("getMachineId", () => {
  it("returns a 16-character hex string", () => {
    expect(getMachineId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable across calls", () => {
    expect(getMachineId()).toBe(getMachineId());
  });
});

describe("identifyUser", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({} as Response);
    mockGetTelemetryConfig.mockReturnValue({
      optedOut: false,
      packageVersion: "1.2.3",
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("sends $identify event to PostHog with telemetryId as distinct_id", () => {
    identifyUser("abc123");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.event).toBe("$identify");
    expect(body.properties.distinct_id).toBe("abc123");
    expect(body.properties.$anon_distinct_id).toBe(getMachineId());
  });

  it("includes PostHog API key in payload", () => {
    identifyUser("abc123");

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.api_key).toBe("phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045");
  });

  it("includes timestamp in ISO format", () => {
    identifyUser("abc123");

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("does not call fetch when telemetry is opted out", () => {
    mockGetTelemetryConfig.mockReturnValue({
      optedOut: true,
      packageVersion: "1.2.3",
    });

    identifyUser("abc123");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("silently swallows fetch errors", () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));

    expect(() => identifyUser("abc123")).not.toThrow();
  });

  it("POSTs to the correct PostHog capture endpoint", () => {
    identifyUser("abc123");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://eu.i.posthog.com/capture",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});

describe("trackPluginEvent", () => {
  const origMode = process.env["MANIFEST_MODE"];
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env["MANIFEST_MODE"];
    fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({} as Response);
    mockGetTelemetryConfig.mockReturnValue({
      optedOut: false,
      packageVersion: "1.2.3",
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (origMode === undefined) delete process.env["MANIFEST_MODE"];
    else process.env["MANIFEST_MODE"] = origMode;
  });

  describe("opt-out behavior", () => {
    it("should not call fetch when telemetry is opted out", () => {
      mockGetTelemetryConfig.mockReturnValue({
        optedOut: true,
        packageVersion: "1.2.3",
      });

      trackPluginEvent("some_event");

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should return immediately when opted out without building payload", () => {
      mockGetTelemetryConfig.mockReturnValue({
        optedOut: true,
        packageVersion: "1.2.3",
      });

      trackPluginEvent("some_event", { extra: "data" }, "local");

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("mode parameter resolution", () => {
    it("should use explicit mode parameter when provided", () => {
      trackPluginEvent("plugin_registered", undefined, "local");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.mode).toBe("local");
    });

    it("should fall back to MANIFEST_MODE env var when mode parameter is undefined", () => {
      process.env["MANIFEST_MODE"] = "local";

      trackPluginEvent("plugin_registered");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.mode).toBe("local");
    });

    it("should default to 'cloud' when neither mode param nor env var is set", () => {
      delete process.env["MANIFEST_MODE"];

      trackPluginEvent("plugin_registered");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.mode).toBe("cloud");
    });

    it("should prefer explicit mode parameter over MANIFEST_MODE env var", () => {
      process.env["MANIFEST_MODE"] = "cloud";

      trackPluginEvent("plugin_registered", undefined, "local");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.mode).toBe("local");
    });
  });

  describe("PostHog payload structure", () => {
    it("should POST to the correct PostHog capture endpoint", () => {
      trackPluginEvent("test_event");

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://eu.i.posthog.com/capture",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("should include the PostHog API key in the payload", () => {
      trackPluginEvent("test_event");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.api_key).toBe("phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045");
    });

    it("should include event name in the payload", () => {
      trackPluginEvent("plugin_registered");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.event).toBe("plugin_registered");
    });

    it("should include a timestamp in ISO format", () => {
      trackPluginEvent("test_event");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it("should include distinct_id derived from machine identity", () => {
      trackPluginEvent("test_event");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.distinct_id).toBeDefined();
      expect(typeof body.properties.distinct_id).toBe("string");
      expect(body.properties.distinct_id.length).toBe(16);
    });

    it("should produce a stable distinct_id across calls", () => {
      trackPluginEvent("event_1");
      trackPluginEvent("event_2");

      const body1 = JSON.parse(fetchSpy.mock.calls[0][1].body);
      const body2 = JSON.parse(fetchSpy.mock.calls[1][1].body);
      expect(body1.properties.distinct_id).toBe(body2.properties.distinct_id);
    });

    it("should include os, os_version, and node_version in properties", () => {
      trackPluginEvent("test_event");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.os).toBeDefined();
      expect(body.properties.os_version).toBeDefined();
      expect(body.properties.node_version).toBe(process.versions.node);
    });

    it("should include package_version from telemetry config", () => {
      mockGetTelemetryConfig.mockReturnValue({
        optedOut: false,
        packageVersion: "5.19.0",
      });

      trackPluginEvent("test_event");

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.package_version).toBe("5.19.0");
    });
  });

  describe("custom properties", () => {
    it("should merge additional properties into the payload", () => {
      trackPluginEvent("plugin_mode_selected", { mode: "local" });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.mode).toBe("local");
    });

    it("should allow custom properties to override base properties", () => {
      trackPluginEvent("test_event", { distinct_id: "custom-id" });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.properties.distinct_id).toBe("custom-id");
    });

    it("should work with no custom properties", () => {
      trackPluginEvent("plugin_registered");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.event).toBe("plugin_registered");
    });
  });

  describe("error handling", () => {
    it("should silently swallow fetch errors", () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      expect(() => trackPluginEvent("test_event")).not.toThrow();
    });
  });
});
