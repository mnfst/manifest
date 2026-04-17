import { describe, it, expect, vi } from "vitest";

vi.mock("manifest-shared", () => ({
  platformIcon: (plat: string | null, cat: string | null) => {
    if (!plat) return undefined;
    if (plat === "other") return cat === "personal" ? "/icons/other-agent.svg" : "/icons/other.svg";
    const icons: Record<string, string> = { openclaw: "/icons/openclaw.png" };
    return icons[plat];
  },
}));

import {
  agentPlatform,
  agentCategory,
  setAgentPlatform,
  agentPlatformIcon,
} from "../../src/services/agent-platform-store";

describe("agent-platform-store", () => {
  it("returns null by default", () => {
    expect(agentPlatform()).toBeNull();
    expect(agentCategory()).toBeNull();
  });

  it("sets platform and category", () => {
    setAgentPlatform("openclaw", "personal");
    expect(agentPlatform()).toBe("openclaw");
    expect(agentCategory()).toBe("personal");
  });

  it("returns platform icon via platformIcon helper", () => {
    setAgentPlatform("openclaw", "personal");
    expect(agentPlatformIcon()).toBe("/icons/openclaw.png");
  });

  it("returns other-agent.svg for personal other", () => {
    setAgentPlatform("other", "personal");
    expect(agentPlatformIcon()).toBe("/icons/other-agent.svg");
  });

  it("returns other.svg for app other", () => {
    setAgentPlatform("other", "app");
    expect(agentPlatformIcon()).toBe("/icons/other.svg");
  });

  it("returns undefined when platform is null", () => {
    setAgentPlatform(null, null);
    expect(agentPlatformIcon()).toBeUndefined();
  });

  it("preserves category when not provided", () => {
    setAgentPlatform("openclaw", "personal");
    setAgentPlatform("hermes");
    expect(agentPlatform()).toBe("hermes");
    expect(agentCategory()).toBe("personal");
  });
});
