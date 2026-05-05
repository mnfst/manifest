import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { agentPath } from "../../src/services/routing";
import {
  getComplexityStatus,
  setTierParamDefaults,
  toggleComplexity,
} from "../../src/services/api/routing";

describe("agentPath", () => {
  it("builds path with agent name", () => {
    expect(agentPath("my-agent", "/overview")).toBe("/agents/my-agent/overview");
  });
  it("encodes special characters in agent name", () => {
    expect(agentPath("my agent", "/overview")).toBe("/agents/my%20agent/overview");
  });
  it("returns root when agent is null", () => {
    expect(agentPath(null, "/overview")).toBe("/");
  });
});

describe("getComplexityStatus", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the correct endpoint and returns the parsed response", async () => {
    const payload = { enabled: true };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    } as Response);

    const result = await getComplexityStatus("my-agent");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/routing/my-agent/complexity/status"),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result).toEqual(payload);
  });
});

describe("toggleComplexity", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the correct endpoint with POST and returns the parsed response", async () => {
    const payload = { enabled: false };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    } as Response);

    const result = await toggleComplexity("my-agent");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/routing/my-agent/complexity/toggle"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(payload);
  });
});

describe("setTierParamDefaults", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCHes /params with the supplied defaults", async () => {
    const payload = { tier: "standard", param_defaults: { thinking: { type: "disabled" } } };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    } as Response);

    const result = await setTierParamDefaults("my-agent", "standard", {
      thinking: { type: "disabled" },
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/routing/my-agent/tiers/standard/params"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ paramDefaults: { thinking: { type: "disabled" } } }),
      }),
    );
    expect(result).toEqual(payload);
  });

  it("sends paramDefaults: null to clear", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({})),
    } as Response);

    await setTierParamDefaults("my-agent", "standard", null);
    const call = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse((call[1]!.body as string))).toEqual({ paramDefaults: null });
  });
});
