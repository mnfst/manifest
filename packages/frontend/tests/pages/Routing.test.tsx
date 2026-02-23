import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/components/InfoTooltip.js", () => ({
  default: (props: any) => <span class="info-tooltip">{props.text ?? props.children}</span>,
}));

vi.mock("../../src/services/routing.js", () => ({
  agentPath: (name: string, sub: string) => `/agents/${name}${sub}`,
  useAgentName: () => () => "test-agent",
}));

vi.mock("../../src/services/api.js", () => ({
  getTierAssignments: vi.fn().mockResolvedValue([
    { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "3", user_id: "u1", tier: "complex", override_model: "claude-opus-4-6", auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
  ]),
  getAvailableModels: vi.fn().mockResolvedValue([
    { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true, capability_vision: true, capability_tool_calling: true, capability_structured_output: true },
    { model_name: "claude-opus-4-6", provider: "Anthropic", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true, capability_vision: true, capability_tool_calling: true, capability_structured_output: true },
  ]),
  getProviders: vi.fn().mockResolvedValue([
    { id: "p1", provider: "openai", is_active: true, connected_at: "2025-01-01" },
  ]),
  overrideTier: vi.fn().mockResolvedValue({}),
  resetTier: vi.fn().mockResolvedValue({}),
  resetAllTiers: vi.fn().mockResolvedValue({}),
}));

import Routing from "../../src/pages/Routing";

describe("Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Routing heading", () => {
    render(() => <Routing />);
    expect(screen.getByText("Routing")).toBeDefined();
  });

  it("renders all four tier labels", async () => {
    render(() => <Routing />);
    const sel = { selector: ".routing-card__tier" };
    expect(await screen.findByText("Simple", sel)).toBeDefined();
    expect(screen.getByText("Standard", sel)).toBeDefined();
    expect(screen.getByText("Complex", sel)).toBeDefined();
    expect(screen.getByText("Reasoning", sel)).toBeDefined();
  });

  it("renders tier descriptions in tooltip", () => {
    render(() => <Routing />);
    // Tier descriptions are now inside the InfoTooltip next to the heading
    const tooltip = document.querySelector(".info-tooltip");
    expect(tooltip).toBeDefined();
    expect(tooltip?.textContent).toContain("Simple");
    expect(tooltip?.textContent).toContain("Reasoning");
  });

  it("shows custom tag only for override tiers", async () => {
    render(() => <Routing />);
    // complex has an override => 1 custom tag
    const customTags = await screen.findAllByText("custom");
    expect(customTags.length).toBe(1);
  });

  it("shows model labels for assigned models", async () => {
    render(() => <Routing />);
    // gpt-4o-mini resolves to "GPT-4o Mini" via OpenAI provider models
    const miniLabels = await screen.findAllByText("GPT-4o Mini");
    expect(miniLabels.length).toBeGreaterThanOrEqual(1);
    // claude-opus-4-6 resolves to "Claude Opus 4.6" via Anthropic provider models
    expect(screen.getByText("Claude Opus 4.6")).toBeDefined();
  });

  it("shows Override button for non-override tiers", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    // simple, standard, reasoning have no override => 3 Override buttons
    expect(overrideButtons.length).toBe(3);
  });

  it("shows Edit and Reset buttons for override tiers", async () => {
    render(() => <Routing />);
    // complex tier has an override_model set
    expect(await screen.findByText("Edit")).toBeDefined();
    expect(screen.getByText("Reset")).toBeDefined();
  });

  it("shows Reset all to auto button when overrides exist", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Reset all to auto")).toBeDefined();
  });

  it("renders breadcrumb with agent name", () => {
    render(() => <Routing />);
    const matches = screen.getAllByText(/test-agent/);
    const breadcrumb = matches.find((el) => el.classList.contains("breadcrumb"));
    expect(breadcrumb).toBeDefined();
  });
});
