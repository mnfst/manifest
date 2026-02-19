import { describe, it, expect } from "vitest";
import { agentPath } from "../../src/services/routing.js";

describe("agentPath", () => {
  it("builds path for agent with sub-route", () => {
    expect(agentPath("my-bot", "/messages")).toBe("/agents/my-bot/messages");
  });

  it("builds base path for agent", () => {
    expect(agentPath("my-bot", "")).toBe("/agents/my-bot");
  });

  it("encodes special characters in agent name", () => {
    expect(agentPath("bot with spaces", "/settings")).toBe("/agents/bot%20with%20spaces/settings");
  });

  it("returns / when agentName is null", () => {
    expect(agentPath(null, "/messages")).toBe("/");
    expect(agentPath(null, "")).toBe("/");
  });
});
