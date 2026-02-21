import { describe, it, expect } from "vitest";
import { agentPath } from "../../src/services/routing";

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
