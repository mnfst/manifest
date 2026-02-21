import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href} class={props.class}>{props.children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/api.js", () => ({
  getAgents: vi.fn().mockResolvedValue({
    agents: [
      { agent_name: "demo-agent", message_count: 42, last_active: "2024-01-01", total_cost: 5.5, total_tokens: 15000, sparkline: [1, 2, 3] },
    ],
  }),
  createAgent: vi.fn().mockResolvedValue({ apiKey: "test-key" }),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/Sparkline.jsx", () => ({
  default: () => <div data-testid="sparkline" />,
}));

import Workspace from "../../src/pages/Workspace";

describe("Workspace", () => {
  it("renders My Agents heading", async () => {
    render(() => <Workspace />);
    expect(screen.getByText("My Agents")).toBeDefined();
  });

  it("renders Connect Agent button", () => {
    render(() => <Workspace />);
    const buttons = screen.getAllByText("Connect Agent");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
