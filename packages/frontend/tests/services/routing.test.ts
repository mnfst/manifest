import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { agentPath } from "../../src/services/routing";
import {
  connectProvider,
  disconnectProvider,
  getComplexityStatus,
  renameProviderKey,
  reorderProviderKeys,
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

describe("multi-key provider API helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connectProvider forwards label in the JSON body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ id: "p1", provider: "openai", auth_type: "api_key", is_active: true, label: "Work", priority: 1 })),
    } as Response);

    await connectProvider("my-agent", {
      provider: "openai",
      apiKey: "sk-test",
      authType: "api_key",
      label: "Work",
    });

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      provider: "openai",
      apiKey: "sk-test",
      authType: "api_key",
      label: "Work",
    });
  });

  it("disconnectProvider appends label query param when provided", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ ok: true, notifications: [] })),
    } as Response);

    await disconnectProvider("my-agent", "openai", "api_key", "Work");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/routing\/my-agent\/providers\/openai\?authType=api_key&label=Work/),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("disconnectProvider drops both query params when neither is given", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ ok: true, notifications: [] })),
    } as Response);

    await disconnectProvider("my-agent", "openai");

    const url = vi.mocked(fetch).mock.calls[0]![0] as string;
    expect(url).not.toContain("?");
  });

  it("renameProviderKey targets the labeled key endpoint with PATCH", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ id: "p1", label: "Home", priority: 0 })),
    } as Response);

    await renameProviderKey("my-agent", "openai", "Personal", "Home", "api_key");

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toMatch(/\/routing\/my-agent\/providers\/openai\/keys\/Personal/);
    expect(call[1]!.method).toBe("PATCH");
    expect(JSON.parse(call[1]!.body as string)).toEqual({ newLabel: "Home", authType: "api_key" });
  });

  it("reorderProviderKeys posts the labels array via PUT", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify([])),
    } as Response);

    await reorderProviderKeys("my-agent", "openai", ["Work", "Personal"], "api_key");

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toMatch(/\/routing\/my-agent\/providers\/openai\/keys\/order/);
    expect(call[1]!.method).toBe("PUT");
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      labels: ["Work", "Personal"],
      authType: "api_key",
    });
  });
});
