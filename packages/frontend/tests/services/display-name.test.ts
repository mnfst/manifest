import { describe, it, expect, vi, beforeEach } from "vitest";

// Track signal states created by our mock
const signalStates: { value: unknown }[] = [];

vi.mock("solid-js", () => ({
  createSignal: (init: unknown) => {
    const state = { value: init };
    signalStates.push(state);
    return [() => state.value, (v: unknown) => { state.value = v; }];
  },
}));

describe("display-name", () => {
  let getItemSpy: ReturnType<typeof vi.fn>;
  let setItemSpy: ReturnType<typeof vi.fn>;
  let removeItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    signalStates.length = 0;

    getItemSpy = vi.fn().mockReturnValue(null);
    setItemSpy = vi.fn();
    removeItemSpy = vi.fn();

    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: getItemSpy,
        setItem: setItemSpy,
        removeItem: removeItemSpy,
      },
      writable: true,
      configurable: true,
    });
  });

  it("initializes signal with empty string when localStorage has no value", async () => {
    getItemSpy.mockReturnValue(null);

    const { displayName } = await import("../../src/services/display-name.js");

    expect(getItemSpy).toHaveBeenCalledWith("manifest-display-name");
    expect(displayName()).toBe("");
  });

  it("initializes signal with stored value from localStorage", async () => {
    getItemSpy.mockReturnValue("Alice");

    const { displayName } = await import("../../src/services/display-name.js");

    expect(displayName()).toBe("Alice");
  });

  it("displayName returns current signal value", async () => {
    getItemSpy.mockReturnValue("Bob");

    const { displayName } = await import("../../src/services/display-name.js");

    expect(displayName()).toBe("Bob");
  });

  it("setDisplayName stores trimmed value in localStorage when non-empty", async () => {
    const { setDisplayName } = await import("../../src/services/display-name.js");

    setDisplayName("Charlie");

    expect(setItemSpy).toHaveBeenCalledWith("manifest-display-name", "Charlie");
    expect(removeItemSpy).not.toHaveBeenCalled();
  });

  it("setDisplayName trims whitespace before storing", async () => {
    const { displayName, setDisplayName } = await import("../../src/services/display-name.js");

    setDisplayName("  Dana  ");

    expect(setItemSpy).toHaveBeenCalledWith("manifest-display-name", "Dana");
    expect(displayName()).toBe("Dana");
  });

  it("setDisplayName removes from localStorage when value is empty after trim", async () => {
    const { displayName, setDisplayName } = await import("../../src/services/display-name.js");

    setDisplayName("");

    expect(removeItemSpy).toHaveBeenCalledWith("manifest-display-name");
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(displayName()).toBe("");
  });

  it("setDisplayName removes from localStorage when value is only whitespace", async () => {
    const { displayName, setDisplayName } = await import("../../src/services/display-name.js");

    setDisplayName("   ");

    expect(removeItemSpy).toHaveBeenCalledWith("manifest-display-name");
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(displayName()).toBe("");
  });

  it("setDisplayName updates signal so displayName reflects new value", async () => {
    const { displayName, setDisplayName } = await import("../../src/services/display-name.js");

    expect(displayName()).toBe("");

    setDisplayName("Eve");
    expect(displayName()).toBe("Eve");

    setDisplayName("Frank");
    expect(displayName()).toBe("Frank");
  });

  it("setDisplayName clears signal when given empty string after prior value", async () => {
    getItemSpy.mockReturnValue("Grace");

    const { displayName, setDisplayName } = await import("../../src/services/display-name.js");

    expect(displayName()).toBe("Grace");

    setDisplayName("");
    expect(displayName()).toBe("");
    expect(removeItemSpy).toHaveBeenCalledWith("manifest-display-name");
  });
});
