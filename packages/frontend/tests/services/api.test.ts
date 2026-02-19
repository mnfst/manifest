import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAgents,
  getOverview,
  getTokens,
  getCosts,
  getMessages,
  getSecurity,
  getHealth,
  getAgentKey,
  rotateAgentKey,
  createAgent,
  deleteAgent,
  getModelPrices,
} from "../../src/services/api.js";

vi.mock("../../src/services/toast-store.js", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("location", { origin: "http://localhost:3000" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Mock a successful response for fetchJson (returns .json()) */
function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

/** Mock a failed response for fetchJson (returns .text()) */
function mockError(status: number, statusText: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(""),
  });
}

/** Mock a successful response for fetchMutate (returns .text()) */
function mockMutateOk(body?: unknown) {
  const text = body !== undefined ? JSON.stringify(body) : "";
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(text),
  });
}

/** Mock a failed response for fetchMutate (returns .json() for parseErrorMessage) */
function mockMutateError(status: number, message: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  });
}

describe("getAgents", () => {
  it("fetches /api/v1/agents", async () => {
    const payload = { agents: [{ agent_name: "bot1" }] };
    mockOk(payload);

    const result = await getAgents();
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/v1/agents", { credentials: "include" });
  });
});

describe("getOverview", () => {
  it("includes range and agent_name params", async () => {
    mockOk({ summary: {} });

    await getOverview("7d", "my-agent");
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("range=7d");
    expect(url).toContain("agent_name=my-agent");
  });

  it("defaults range to 24h", async () => {
    mockOk({ summary: {} });

    await getOverview();
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("range=24h");
  });

  it("omits agent_name when not provided", async () => {
    mockOk({ summary: {} });

    await getOverview("24h");
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).not.toContain("agent_name");
  });
});

describe("getTokens", () => {
  it("sends range and agent_name", async () => {
    mockOk([]);

    await getTokens("6h", "agent-x");
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("range=6h");
    expect(url).toContain("agent_name=agent-x");
  });
});

describe("getCosts", () => {
  it("sends range and agent_name", async () => {
    mockOk([]);

    await getCosts("30d", "agent-y");
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("range=30d");
    expect(url).toContain("agent_name=agent-y");
  });
});

describe("getMessages", () => {
  it("sends all filter params", async () => {
    mockOk({ items: [] });

    await getMessages({ range: "7d", status: "error", agent_name: "bot" });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("range=7d");
    expect(url).toContain("status=error");
    expect(url).toContain("agent_name=bot");
  });

  it("skips empty params", async () => {
    mockOk({ items: [] });

    await getMessages({ range: "24h", status: "" });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("range=24h");
    expect(url).not.toContain("status=");
  });
});

describe("getSecurity", () => {
  it("sends range param", async () => {
    mockOk({ score: {} });

    await getSecurity("7d");
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("range=7d");
  });
});

describe("getHealth", () => {
  it("fetches /api/v1/health", async () => {
    mockOk({ status: "ok" });

    const result = await getHealth();
    expect(result).toEqual({ status: "ok" });
  });
});

describe("error handling", () => {
  it("throws on non-ok response", async () => {
    mockError(500, "Internal Server Error");

    await expect(getHealth()).rejects.toThrow("API error: 500 Internal Server Error");
  });

  it("throws on 404", async () => {
    mockError(404, "Not Found");

    await expect(getAgents()).rejects.toThrow("API error: 404 Not Found");
  });
});

describe("getAgentKey", () => {
  it("should return keyPrefix instead of full apiKey", async () => {
    const payload = { keyPrefix: "mnfst_abc12" };
    mockOk(payload);

    const result = await getAgentKey("my-agent");

    expect(result).toEqual({ keyPrefix: "mnfst_abc12" });
    expect(result).not.toHaveProperty("apiKey");
  });

  it("should include pluginEndpoint when present", async () => {
    const payload = { keyPrefix: "mnfst_xyz99", pluginEndpoint: "https://example.com/otlp" };
    mockOk(payload);

    const result = await getAgentKey("my-agent");

    expect(result).toEqual({
      keyPrefix: "mnfst_xyz99",
      pluginEndpoint: "https://example.com/otlp",
    });
  });

  it("should fetch the correct URL with encoded agent name", async () => {
    mockOk({ keyPrefix: "mnfst_test" });

    await getAgentKey("agent with spaces");

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("/agents/agent%20with%20spaces/key");
  });

  it("should encode special characters in agent name", async () => {
    mockOk({ keyPrefix: "mnfst_test" });

    await getAgentKey("agent/name");

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("/agents/agent%2Fname/key");
  });

  it("should use GET with credentials: include", async () => {
    mockOk({ keyPrefix: "mnfst_test" });

    await getAgentKey("bot");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/agents/bot/key"),
      { credentials: "include" },
    );
  });
});

describe("rotateAgentKey", () => {
  it("should POST to the rotate-key endpoint and return the new full key", async () => {
    const payload = { apiKey: "mnfst_newFullKey123abc" };
    mockMutateOk(payload);

    const result = await rotateAgentKey("my-agent");

    expect(result).toEqual({ apiKey: "mnfst_newFullKey123abc" });
  });

  it("should use POST method with credentials: include", async () => {
    mockMutateOk({ apiKey: "mnfst_abc" });

    await rotateAgentKey("my-agent");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/agents/my-agent/rotate-key",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("should encode special characters in agent name", async () => {
    mockMutateOk({ apiKey: "mnfst_abc" });

    await rotateAgentKey("agent/special name");

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("/agents/agent%2Fspecial%20name/rotate-key");
  });

  it("should throw and call toast.error on failure", async () => {
    const { toast } = await import("../../src/services/toast-store.js");
    mockMutateError(403, "Forbidden");

    await expect(rotateAgentKey("my-agent")).rejects.toThrow("Forbidden");
    expect(toast.error).toHaveBeenCalledWith("Forbidden");
  });
});

describe("createAgent", () => {
  it("should return agent object and full apiKey", async () => {
    const payload = {
      agent: { id: "uuid-123", name: "new-bot" },
      apiKey: "mnfst_fullKeyShownOnce",
    };
    mockMutateOk(payload);

    const result = await createAgent("new-bot");

    expect(result).toEqual({
      agent: { id: "uuid-123", name: "new-bot" },
      apiKey: "mnfst_fullKeyShownOnce",
    });
  });

  it("should POST to /api/v1/agents with JSON body", async () => {
    mockMutateOk({ agent: { id: "1", name: "bot" }, apiKey: "mnfst_x" });

    await createAgent("bot");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/agents",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "bot" }),
      }),
    );
  });

  it("should throw and show toast on validation error", async () => {
    const { toast } = await import("../../src/services/toast-store.js");
    mockMutateError(400, "Agent name is required");

    await expect(createAgent("")).rejects.toThrow("Agent name is required");
    expect(toast.error).toHaveBeenCalledWith("Agent name is required");
  });
});

describe("deleteAgent", () => {
  it("should send DELETE to the correct URL", async () => {
    mockMutateOk();

    await deleteAgent("old-bot");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/agents/old-bot",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("should encode agent name in URL", async () => {
    mockMutateOk();

    await deleteAgent("bot/with spaces");

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("/agents/bot%2Fwith%20spaces");
  });

  it("should return undefined for empty response body", async () => {
    mockMutateOk();

    const result = await deleteAgent("bot");

    expect(result).toBeUndefined();
  });
});

describe("getModelPrices", () => {
  it("should fetch /api/v1/model-prices", async () => {
    const prices = [{ model: "gpt-4", input_cost: 0.03, output_cost: 0.06 }];
    mockOk(prices);

    const result = await getModelPrices();

    expect(result).toEqual(prices);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/model-prices",
      { credentials: "include" },
    );
  });
});

describe("fetchMutate error handling", () => {
  it("should parse JSON error message from response body", async () => {
    const { toast } = await import("../../src/services/toast-store.js");
    mockMutateError(422, "Name already taken");

    await expect(createAgent("dup")).rejects.toThrow("Name already taken");
    expect(toast.error).toHaveBeenCalledWith("Name already taken");
  });

  it("should parse array error messages joined by comma", async () => {
    const { toast } = await import("../../src/services/toast-store.js");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: ["field is required", "name too short"] }),
    });

    await expect(createAgent("x")).rejects.toThrow("field is required, name too short");
    expect(toast.error).toHaveBeenCalledWith("field is required, name too short");
  });

  it("should fall back to status code when body is not JSON", async () => {
    const { toast } = await import("../../src/services/toast-store.js");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(deleteAgent("bot")).rejects.toThrow("Request failed (500)");
    expect(toast.error).toHaveBeenCalledWith("Request failed (500)");
  });
});
