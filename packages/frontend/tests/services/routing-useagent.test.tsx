import { describe, it, expect, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
  useLocation: () => ({ pathname: "/agents/test-agent/overview" }),
}));

import { useAgentName } from "../../src/services/routing";

describe("useAgentName", () => {
  it("extracts agent name from pathname", () => {
    const getAgentName = useAgentName();
    expect(getAgentName()).toBe("test-agent");
  });

  it("returns a function", () => {
    const getAgentName = useAgentName();
    expect(typeof getAgentName).toBe("function");
  });
});
