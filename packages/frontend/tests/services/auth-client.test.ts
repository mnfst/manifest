import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Spy that `createAuthClient` from `better-auth/solid` resolves to. The
// module under test (`auth-client.ts`) imports this symbol and invokes it
// once at module-load time, so we mock it before any dynamic import below.
// Use `vi.hoisted` so the spy is available to the hoisted `vi.mock` factory.
const { createAuthClientMock } = vi.hoisted(() => ({
  createAuthClientMock: vi.fn((config: unknown) => ({
    __mockClient: true,
    config,
  })),
}));

vi.mock("better-auth/solid", () => ({
  createAuthClient: createAuthClientMock,
}));

describe("authClient", () => {
  beforeEach(() => {
    // Each test re-imports the module to re-trigger the top-level
    // `createAuthClient({...})` call against a fresh mock state.
    vi.resetModules();
    createAuthClientMock.mockClear();

    // Pin `window.location.origin` to a deterministic value. jsdom would
    // otherwise return "http://localhost:3000", which is fine but we want
    // tests to be insensitive to harness defaults.
    vi.stubGlobal("window", {
      ...window,
      location: {
        ...window.location,
        origin: "https://dashboard.manifest.build",
      },
    } as Window & typeof globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates client with correct baseURL from window.location.origin", async () => {
    await import("../../src/services/auth-client.js");

    expect(createAuthClientMock).toHaveBeenCalledTimes(1);
    const config = createAuthClientMock.mock.calls[0][0] as {
      baseURL: string;
      basePath: string;
    };
    expect(config.baseURL).toBe("https://dashboard.manifest.build");
  });

  it("creates client with basePath /api/auth", async () => {
    await import("../../src/services/auth-client.js");

    expect(createAuthClientMock).toHaveBeenCalledTimes(1);
    const config = createAuthClientMock.mock.calls[0][0] as {
      baseURL: string;
      basePath: string;
    };
    expect(config.basePath).toBe("/api/auth");
  });

  it("exports authClient as createAuthClient return type", async () => {
    const mod = await import("../../src/services/auth-client.js");

    // The exported `authClient` must be the exact value returned by
    // `createAuthClient`. We return a tagged object from the mock so we
    // can assert identity, not just shape.
    expect(mod.authClient).toBeDefined();
    expect((mod.authClient as unknown as { __mockClient: boolean }).__mockClient).toBe(true);
    expect(mod.authClient).toBe(createAuthClientMock.mock.results[0].value);
  });

  it("initialization does not throw errors", async () => {
    // The module evaluates its top-level `createAuthClient({...})` call
    // synchronously on import. A throw inside `createAuthClient` would
    // surface here as a rejected promise from the dynamic import.
    await expect(import("../../src/services/auth-client.js")).resolves.toBeDefined();
  });

  it("re-reads window.location.origin on each module load", async () => {
    // First load uses the stubbed origin from beforeEach.
    await import("../../src/services/auth-client.js");
    expect(createAuthClientMock.mock.calls[0][0]).toMatchObject({
      baseURL: "https://dashboard.manifest.build",
    });

    // Swap the origin and reload. We expect a fresh `createAuthClient`
    // call with the new origin, proving the module is not cached against
    // a stale value baked at first import.
    vi.resetModules();
    createAuthClientMock.mockClear();
    vi.stubGlobal("window", {
      ...window,
      location: {
        ...window.location,
        origin: "http://localhost:3001",
      },
    } as Window & typeof globalThis);

    await import("../../src/services/auth-client.js");
    expect(createAuthClientMock).toHaveBeenCalledTimes(1);
    expect(createAuthClientMock.mock.calls[0][0]).toMatchObject({
      baseURL: "http://localhost:3001",
      basePath: "/api/auth",
    });
  });
});
