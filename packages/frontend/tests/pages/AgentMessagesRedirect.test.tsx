import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

let mockAgentName = "demo-agent";
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: mockAgentName }),
  Navigate: (props: any) => <div data-testid="navigate" data-href={props.href} />,
}));

import AgentMessagesRedirect from "../../src/pages/AgentMessagesRedirect.jsx";

describe("AgentMessagesRedirect", () => {
  it("redirects to the global log pre-scoped to the harness via ?agent=", () => {
    mockAgentName = "demo-agent";
    const { getByTestId } = render(() => <AgentMessagesRedirect />);
    expect(getByTestId("navigate").getAttribute("data-href")).toBe("/messages?agent=demo-agent");
  });

  it("URL-encodes the agent name", () => {
    mockAgentName = "my agent/v2";
    const { getByTestId } = render(() => <AgentMessagesRedirect />);
    expect(getByTestId("navigate").getAttribute("data-href")).toBe(
      "/messages?agent=my%20agent%2Fv2",
    );
  });
});
