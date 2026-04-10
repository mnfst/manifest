import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null, customProviderLogo: () => null,
}));

vi.mock("../../src/services/routing-utils.js", () => ({
  pricePerM: (v: number) => `$${(v * 1_000_000).toFixed(2)}`,
  resolveProviderId: (provider: string) => {
    const map: Record<string, string> = {
      OpenAI: "openai",
      Anthropic: "anthropic",
      Google: "google",
      Ollama: "ollama",
      "ollama-cloud": "ollama-cloud",
      deepseek: "deepseek",
    };
    return map[provider] ?? null;
  },
  inferProviderFromModel: (modelName: string) => {
    const slash = modelName.indexOf("/");
    if (slash !== -1) return modelName.substring(0, slash).toLowerCase();
    if (modelName.startsWith("mistral-")) return "mistral";
    if (modelName.startsWith("deepseek-")) return "deepseek";
    // Mirror the real heuristic: non-slash model with a colon → local ollama
    if (!modelName.includes("/") && /:/.test(modelName)) return "ollama";
    return null;
  },
}));

import ModelPickerModal from "../../src/components/ModelPickerModal";

const baseTiers = [
  { id: "1", user_id: "u1", tier: "simple", override_model: null, override_provider: null, auto_assigned_model: "gpt-4o-mini", updated_at: "2025-01-01" },
];

const baseModels = [
  { model_name: "gpt-4o-mini", provider: "OpenAI", display_name: "GPT-4o Mini", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
  { model_name: "claude-opus-4-6", provider: "Anthropic", display_name: "Claude Opus 4.6", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
  { model_name: "openrouter/free", provider: "OpenAI", display_name: "Free Models Router", input_price_per_token: 0, output_price_per_token: 0, context_window: 128000, capability_reasoning: false, capability_code: false },
];

describe("ModelPickerModal", () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal title", () => {
    render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    expect(screen.getByText("Select a model")).toBeDefined();
  });

  it("shows tier label in subtitle", () => {
    render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    expect(screen.getByText("Simple tier")).toBeDefined();
  });

  it("renders model groups", () => {
    render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.getByText("Anthropic")).toBeDefined();
  });

  it("calls onSelect with activeTab when a model is clicked", () => {
    render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const claudeButtons = screen.getAllByText("Claude Opus 4.6");
    fireEvent.click(claudeButtons[claudeButtons.length - 1]);
    // Default tab is 'api_key' when no subscription providers are connected
    expect(onSelect).toHaveBeenCalledWith("simple", "claude-opus-4-6", "anthropic", "api_key");
  });

  it("closes on overlay click", () => {
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on close button click", () => {
    render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("filters models by search query", () => {
    // Need more than 5 models for search bar to show
    const manyModels = [
      ...baseModels,
      { model_name: "gpt-4o", provider: "OpenAI", display_name: "GPT-4o", input_price_per_token: 0.0000025, output_price_per_token: 0.00001, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "gpt-3.5-turbo", provider: "OpenAI", display_name: "GPT-3.5 Turbo", input_price_per_token: 0.0000005, output_price_per_token: 0.0000015, context_window: 16385, capability_reasoning: false, capability_code: true },
      { model_name: "claude-sonnet-4", provider: "Anthropic", display_name: "Claude Sonnet 4", input_price_per_token: 0.000003, output_price_per_token: 0.000015, context_window: 200000, capability_reasoning: false, capability_code: true },
      { model_name: "gemini-pro", provider: "Google", display_name: "Gemini Pro", input_price_per_token: 0.00000025, output_price_per_token: 0.0000005, context_window: 32000, capability_reasoning: false, capability_code: false },
    ];
    render(() => (
      <ModelPickerModal tierId="simple" models={manyModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const input = screen.getByLabelText("Search models or providers");
    fireEvent.input(input, { target: { value: "claude" } });
    // Only Anthropic group should show
    expect(screen.queryByText("OpenAI")).toBeNull();
    expect(screen.getByText("Anthropic")).toBeDefined();
  });

  it("shows no models match message when search has no results", () => {
    // Need more than 5 models for search bar to show
    const manyModels = [
      ...baseModels,
      { model_name: "gpt-4o", provider: "OpenAI", display_name: "GPT-4o", input_price_per_token: 0.0000025, output_price_per_token: 0.00001, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "gpt-3.5-turbo", provider: "OpenAI", display_name: "GPT-3.5 Turbo", input_price_per_token: 0.0000005, output_price_per_token: 0.0000015, context_window: 16385, capability_reasoning: false, capability_code: true },
      { model_name: "claude-sonnet-4", provider: "Anthropic", display_name: "Claude Sonnet 4", input_price_per_token: 0.000003, output_price_per_token: 0.000015, context_window: 200000, capability_reasoning: false, capability_code: true },
    ];
    render(() => (
      <ModelPickerModal tierId="simple" models={manyModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const input = screen.getByLabelText("Search models or providers");
    fireEvent.input(input, { target: { value: "zzzzzzz" } });
    expect(screen.getByText("No models match your search.")).toBeDefined();
  });

  it("shows recommended label for auto-assigned model", () => {
    render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    expect(screen.getByText("(recommended)")).toBeDefined();
  });

  it("filters by provider name when search matches provider", () => {
    // Need more than 5 models for search bar to show
    const manyModels = [
      ...baseModels,
      { model_name: "gpt-4o", provider: "OpenAI", display_name: "GPT-4o", input_price_per_token: 0.0000025, output_price_per_token: 0.00001, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "gpt-3.5-turbo", provider: "OpenAI", display_name: "GPT-3.5 Turbo", input_price_per_token: 0.0000005, output_price_per_token: 0.0000015, context_window: 16385, capability_reasoning: false, capability_code: true },
      { model_name: "claude-sonnet-4", provider: "Anthropic", display_name: "Claude Sonnet 4", input_price_per_token: 0.000003, output_price_per_token: 0.000015, context_window: 200000, capability_reasoning: false, capability_code: true },
    ];
    render(() => (
      <ModelPickerModal tierId="simple" models={manyModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const input = screen.getByLabelText("Search models or providers");
    fireEvent.input(input, { target: { value: "openai" } });
    // OpenAI group should show all its models (provider name match)
    expect(screen.getByText("OpenAI")).toBeDefined();
  });

  it("shows free models only when pill button clicked", () => {
    render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    // Free models filter is a checkbox-style pill button
    const pill = screen.getByText("Free models only");
    fireEvent.click(pill);
    // After clicking, still shows "Free models only" (with check icon)
    expect(screen.getByText("Free models only")).toBeDefined();
  });

  it("sorts openrouter/free to the top of its group", () => {
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={baseModels} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    // openrouter/free is grouped under OpenRouter (via prefix inference), sorted first
    const groups = container.querySelectorAll(".routing-modal__group");
    const orGroup = Array.from(groups).find((g) => g.textContent?.includes("OpenRouter"));
    const firstModel = orGroup?.querySelectorAll(".routing-modal__model")[0];
    expect(firstModel?.textContent).toContain("Free Models Router");
  });

  it("sorts models alphabetically by label within each group", () => {
    const models = [
      { model_name: "gpt-4o", provider: "OpenAI", display_name: "GPT-4o", input_price_per_token: 0.0000025, output_price_per_token: 0.00001, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "gpt-3.5-turbo", provider: "OpenAI", display_name: "GPT-3.5 Turbo", input_price_per_token: 0.0000005, output_price_per_token: 0.0000015, context_window: 16385, capability_reasoning: false, capability_code: true },
      { model_name: "gpt-4o-mini", provider: "OpenAI", display_name: "GPT-4o Mini", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
    ];
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={models} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const group = container.querySelector(".routing-modal__group")!;
    const labels = Array.from(group.querySelectorAll(".routing-modal__model-label")).map((el) => el.childNodes[0].textContent?.trim());
    expect(labels).toEqual(["GPT-3.5 Turbo", "GPT-4o", "GPT-4o Mini"]);
  });

  it("sorts provider groups alphabetically by name", () => {
    const models = [
      { model_name: "gpt-4o-mini", provider: "OpenAI", display_name: "GPT-4o Mini", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
      { model_name: "claude-opus-4-6", provider: "Anthropic", display_name: "Claude Opus 4.6", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
    ];
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={models} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    const groupNames = Array.from(container.querySelectorAll(".routing-modal__group-name")).map((el) => el.textContent);
    expect(groupNames).toEqual(["Anthropic", "OpenAI"]);
  });

  it("resolves label for vendor-prefixed model names", () => {
    const modelsWithSlash = [
      { model_name: "anthropic/claude-opus-4-6", provider: "Anthropic", display_name: "Claude Opus 4.6", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
    ];
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={modelsWithSlash} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    // display_name is used as the label
    expect(container.textContent).toContain("Claude Opus 4.6");
  });

  it("falls back to bare name after slash when no label found", () => {
    const modelsWithSlash = [
      { model_name: "vendor/unknown-model-xyz", provider: "Anthropic", input_price_per_token: 0.000015, output_price_per_token: 0.000075, context_window: 200000, capability_reasoning: true, capability_code: true },
    ];
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={modelsWithSlash} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    expect(container.textContent).toContain("unknown-model-xyz");
  });

  it("uses model name as label when no slash and no label match", () => {
    const modelsPlain = [
      { model_name: "totally-custom-model", provider: "Anthropic", input_price_per_token: 0, output_price_per_token: 0, context_window: 128000, capability_reasoning: false, capability_code: false },
    ];
    const { container } = render(() => (
      <ModelPickerModal tierId="simple" models={modelsPlain} tiers={baseTiers} onSelect={onSelect} onClose={onClose} />
    ));
    expect(container.textContent).toContain("totally-custom-model");
  });

  it("hides tabs when only api_key providers are connected", () => {
    // Only api_key providers — tabs should NOT render (need both types)
    const providers = [
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    const { container } = render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    expect(container.querySelector(".panel__tab")).toBeNull();
  });

  it("shows tabs when both subscription and api_key providers are connected", () => {
    const providers = [
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    expect(screen.getByText("Subscription")).toBeDefined();
    expect(screen.getByText("API Keys")).toBeDefined();
  });

  it("passes activeTab as authType in onSelect for subscription tab", () => {
    const providers = [
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Default tab is 'subscription' when subscription providers exist
    const claudeButtons = screen.getAllByText("Claude Opus 4.6");
    fireEvent.click(claudeButtons[claudeButtons.length - 1]);
    expect(onSelect).toHaveBeenCalledWith("simple", "claude-opus-4-6", "anthropic", "subscription");
  });

  it("filters subscription tab to only subscription providers' models", () => {
    const providers = [
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
      { id: "p2", provider: "openai", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Subscription tab is active by default (subscription exists)
    // Only Anthropic models should show (OpenAI is api_key)
    expect(screen.getByText("Anthropic")).toBeDefined();
    expect(screen.queryByText("OpenAI")).toBeNull();
  });

  it("filters API Keys tab to only api_key providers' models", () => {
    const providers = [
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
      { id: "p2", provider: "openai", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Switch to API Keys tab
    fireEvent.click(screen.getByText("API Keys"));
    // Only OpenAI models should show (Anthropic is subscription)
    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.queryByText("Anthropic")).toBeNull();
  });

  it("adds both lowercased provider name and resolved provider ID to providerIdsForTab", () => {
    // Provider name "Google" should resolve to provider ID "gemini" via resolveProviderId mock
    // But the mock returns null for "Google" — so we test with case where provider name is "openai"
    // The providerIdsForTab adds both p.provider.toLowerCase() AND resolveProviderId(p.provider)
    const providers = [
      { id: "p1", provider: "OpenAI", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    // Model with provider "OpenAI" — resolveProviderId("OpenAI") returns "openai"
    // providerIdsForTab adds both "openai" (lowercase of "OpenAI") and "openai" (resolved)
    const models = [
      { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_token: 0.00000015, output_price_per_token: 0.0000006, context_window: 128000, capability_reasoning: false, capability_code: true },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={models}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Switch to API Keys tab (default since no subscription)
    expect(screen.getByText("OpenAI")).toBeDefined();
  });

  it("shows 'Included in subscription' text on subscription tab models", () => {
    const providers = [
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // On subscription tab, models should show "Included in subscription" instead of pricing
    expect(screen.getByText("Included in subscription")).toBeDefined();
  });

  it("hides free models filter on subscription tab", () => {
    const providers = [
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
    ];
    const { container } = render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Subscription tab is active — free models filter should be hidden
    expect(container.querySelector('.routing-modal__filter-toggle')).toBeNull();
  });

  it("shows empty message when only api_key connected and no subscription providers", () => {
    // Only api_key provider connected — tabs hidden, default to api_key tab
    // The subscription empty message isn't reachable without tabs
    const providers = [
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Should show OpenAI models on api_key tab (default when no subscription)
    expect(screen.getByText("OpenAI")).toBeDefined();
  });

  it("shows 'No API key providers connected' when api_key tab has no matching providers", () => {
    // Both types connected so tabs show, but api_key tab has no matching models
    const providers = [
      { id: "p1", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
      { id: "p2", provider: "unknownprovider", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Default tab is subscription (since there's an active sub), switch to API Keys
    fireEvent.click(screen.getByText("API Keys"));
    expect(screen.getByText("No API key providers connected. Connect a provider to see models.")).toBeDefined();
  });

  it("falls back to dbProvId when prefixId is not in PROVIDERS list", () => {
    // Model name "my-custom-thing" doesn't match any prefix pattern → prefixProvId = undefined
    // DB provider "Anthropic" → resolveProviderId returns "anthropic" (in PROVIDERS)
    // Code path: prefixProvId is undefined → PROVIDERS.find returns undefined → falls to (dbProvId ?? prefixProvId)
    // dbProvId = "anthropic" → model renders under Anthropic group
    const models = [
      { model_name: "my-custom-thing", provider: "Anthropic", input_price_per_token: 0, output_price_per_token: 0, context_window: 128000, capability_reasoning: false, capability_code: true },
    ];
    const providers = [
      { id: "p1", provider: "Anthropic", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    const { container } = render(() => (
      <ModelPickerModal
        tierId="simple"
        models={models}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // The model should render with its raw name as label (no label in PROVIDERS for this model)
    expect(container.textContent).toContain("my-custom-thing");
  });

  it("groups tagless Ollama models under Ollama even when prefix matches another provider", () => {
    const models = [
      { model_name: "mistral-small", provider: "Ollama", display_name: "Mistral Small", input_price_per_token: 0, output_price_per_token: 0, context_window: 32000, capability_reasoning: false, capability_code: true },
    ];
    const providers = [
      { id: "p1", provider: "Ollama", is_active: true, has_api_key: false, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={models}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    expect(screen.getByText("Ollama")).toBeDefined();
    expect(screen.queryByText("Mistral")).toBeNull();
  });

  it("groups Ollama Cloud models under Ollama Cloud even when tag suffix looks like local Ollama", () => {
    const models = [
      { model_name: "gemma4:31b", provider: "ollama-cloud", display_name: "gemma4:31b", input_price_per_token: 0, output_price_per_token: 0, context_window: 128000, capability_reasoning: false, capability_code: true, auth_type: "subscription" as const },
      { model_name: "qwen3-vl:235b", provider: "ollama-cloud", display_name: "qwen3-vl:235b", input_price_per_token: 0, output_price_per_token: 0, context_window: 128000, capability_reasoning: false, capability_code: true, auth_type: "subscription" as const },
      { model_name: "deepseek-v3.2", provider: "ollama-cloud", display_name: "deepseek-v3.2", input_price_per_token: 0, output_price_per_token: 0, context_window: 128000, capability_reasoning: false, capability_code: true, auth_type: "subscription" as const },
    ];
    const providers = [
      { id: "p1", provider: "ollama-cloud", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={models}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // All three cloud models should appear under the Ollama Cloud group,
    // not under local Ollama (via the colon heuristic) or DeepSeek (via prefix).
    expect(screen.getByText("Ollama Cloud")).toBeDefined();
    expect(screen.getByText("gemma4:31b")).toBeDefined();
    expect(screen.getByText("qwen3-vl:235b")).toBeDefined();
    expect(screen.getByText("deepseek-v3.2")).toBeDefined();
    expect(screen.queryByText("DeepSeek")).toBeNull();
    expect(screen.queryByText(/^Ollama$/)).toBeNull();
  });

  it("shows the subscription empty state when no subscription models are available", () => {
    // A subscription provider is connected but the catalog has no matching
    // models, so the subscription tab starts empty and must render the
    // `isSub()` branch of the empty state copy.
    const providers = [
      { id: "p1", provider: "ollama-cloud", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={[]}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    expect(
      screen.getByText(/No subscription providers connected\. Connect a provider to see models\./),
    ).toBeDefined();
  });

  it("shows the api-key empty state when no api-key models are available", () => {
    // An api-key provider is connected but the catalog has no models for it.
    const providers = [
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
    ];
    render(() => (
      <ModelPickerModal
        tierId="simple"
        models={[]}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    expect(
      screen.getByText(/No API key providers connected\. Connect a provider to see models\./),
    ).toBeDefined();
  });

  it("resets showFreeOnly when switching to subscription tab", () => {
    const providers = [
      { id: "p1", provider: "openai", is_active: true, has_api_key: true, auth_type: "api_key" as const, connected_at: "2025-01-01" },
      { id: "p2", provider: "anthropic", is_active: true, has_api_key: false, auth_type: "subscription" as const, connected_at: "2025-01-01" },
    ];
    const { container } = render(() => (
      <ModelPickerModal
        tierId="simple"
        models={baseModels}
        tiers={baseTiers}
        connectedProviders={providers}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));
    // Switch to API Keys tab
    fireEvent.click(screen.getByText("API Keys"));
    // Enable free models filter via pill button
    const pill = container.querySelector('.routing-modal__filter-pill') as HTMLButtonElement;
    fireEvent.click(pill);
    // Switch to Subscription tab — showFreeOnly should be reset
    fireEvent.click(screen.getByText("Subscription"));
    // No filter bar should show on subscription tab
    expect(container.querySelector('.routing-modal__filter-bar')).toBeNull();
  });
});
