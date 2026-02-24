import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  useNavigate: () => vi.fn(),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(true),
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

vi.mock("../../src/components/ProviderSelectModal.js", () => ({
  default: (props: any) => (
    <div data-testid="provider-modal">
      <button onClick={props.onClose}>Done</button>
    </div>
  ),
}));

const mockGetProviders = vi.fn();
const mockDeactivateAllProviders = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  getTierAssignments: vi.fn().mockResolvedValue([
    { id: "1", user_id: "u1", tier: "simple", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "2", user_id: "u1", tier: "standard", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "3", user_id: "u1", tier: "complex", override_model: "claude-opus-4-6", auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
    { id: "4", user_id: "u1", tier: "reasoning", override_model: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
  ]),
  getAvailableModels: vi.fn().mockResolvedValue([
    { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
    { model_name: "claude-opus-4-6", provider: "Anthropic", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
  ]),
  getProviders: (...args: unknown[]) => mockGetProviders(...args),
  connectProvider: vi.fn().mockResolvedValue({}),
  deactivateAllProviders: (...args: unknown[]) => mockDeactivateAllProviders(...args),
  overrideTier: vi.fn().mockResolvedValue({}),
  resetTier: vi.fn().mockResolvedValue({}),
  resetAllTiers: vi.fn().mockResolvedValue({}),
}));

import Routing from "../../src/pages/Routing";

describe("Routing — enabled state (providers active)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([
      { id: "p1", provider: "openai", is_active: true, connected_at: "2025-01-01" },
    ]);
    mockDeactivateAllProviders.mockResolvedValue({ ok: true });
  });

  it("renders Routing heading", () => {
    render(() => <Routing />);
    expect(screen.getByText("Routing")).toBeDefined();
  });

  it("renders all four tier labels", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Simple")).toBeDefined();
    expect(screen.getByText("Standard")).toBeDefined();
    expect(screen.getByText("Complex")).toBeDefined();
    expect(screen.getByText("Reasoning")).toBeDefined();
  });

  it("renders tier descriptions", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Heartbeats, greetings, and low-cost tasks that any model can handle.")).toBeDefined();
  });

  it("shows auto tag for non-override tiers", async () => {
    render(() => <Routing />);
    const autoTags = await screen.findAllByText("auto");
    // simple, standard, reasoning are auto (3 tiers); complex has an override
    expect(autoTags.length).toBe(3);
  });

  it("shows Override button for non-override tiers", async () => {
    render(() => <Routing />);
    const overrideButtons = await screen.findAllByText("Override");
    expect(overrideButtons.length).toBe(3);
  });

  it("shows Edit and Reset buttons for override tiers", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Edit")).toBeDefined();
    expect(screen.getByText("Reset")).toBeDefined();
  });

  it("shows Reset all to auto button when overrides exist", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Reset all to auto")).toBeDefined();
  });

  it("shows provider count button", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("1 provider")).toBeDefined();
  });

  it("shows Disable Routing button", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Disable Routing")).toBeDefined();
  });

  it("renders breadcrumb with agent name", () => {
    render(() => <Routing />);
    const matches = screen.getAllByText(/test-agent/);
    const breadcrumb = matches.find((el) => el.classList.contains("breadcrumb"));
    expect(breadcrumb).toBeDefined();
  });
});

describe("Routing — disabled state (no active providers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([]);
  });

  it("shows Enable Routing button when no providers active", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Enable Routing")).toBeDefined();
  });

  it("shows description about smart routing", async () => {
    render(() => <Routing />);
    expect(await screen.findByText("Smart model routing")).toBeDefined();
  });
});
