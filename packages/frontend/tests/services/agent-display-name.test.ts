import { describe, it, expect, vi, beforeEach } from "vitest";

const signalStates: { value: unknown }[] = [];

vi.mock("solid-js", () => ({
  createSignal: (init: unknown) => {
    const state = { value: init };
    signalStates.push(state);
    return [() => state.value, (v: unknown) => { state.value = v; }];
  },
}));

describe("agent-display-name", () => {
  beforeEach(() => {
    vi.resetModules();
    signalStates.length = 0;
  });

  it("initializes with null", async () => {
    const { agentDisplayName } = await import("../../src/services/agent-display-name.js");
    expect(agentDisplayName()).toBeNull();
  });

  it("setAgentDisplayName updates the signal", async () => {
    const { agentDisplayName, setAgentDisplayName } = await import("../../src/services/agent-display-name.js");

    setAgentDisplayName("Molly");
    expect(agentDisplayName()).toBe("Molly");
  });

  it("setAgentDisplayName can set back to null", async () => {
    const { agentDisplayName, setAgentDisplayName } = await import("../../src/services/agent-display-name.js");

    setAgentDisplayName("Molly");
    expect(agentDisplayName()).toBe("Molly");

    setAgentDisplayName(null);
    expect(agentDisplayName()).toBeNull();
  });

  it("agentDisplayName reflects latest value", async () => {
    const { agentDisplayName, setAgentDisplayName } = await import("../../src/services/agent-display-name.js");

    setAgentDisplayName("Alpha");
    expect(agentDisplayName()).toBe("Alpha");

    setAgentDisplayName("Beta");
    expect(agentDisplayName()).toBe("Beta");
  });
});
