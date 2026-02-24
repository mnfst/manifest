import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({}),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockGetModelPrices = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getModelPrices: () => mockGetModelPrices(),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import ModelPrices from "../../src/pages/ModelPrices";

const modelData = {
  models: [
    { model_name: "gpt-4o", provider: "OpenAI", input_price_per_million: 2.5, output_price_per_million: 10 },
    { model_name: "claude-3.5-sonnet", provider: "Anthropic", input_price_per_million: 3, output_price_per_million: 15 },
    { model_name: "gpt-4o-mini", provider: "OpenAI", input_price_per_million: 0.15, output_price_per_million: 0.6 },
    { model_name: "gemini-2.5-pro", provider: "Google", input_price_per_million: 1.25, output_price_per_million: 10 },
  ],
  lastSyncedAt: "2026-02-18T10:00:00Z",
};

/** Helper: wait for data to load then return container */
async function renderAndWait() {
  const result = render(() => <ModelPrices />);
  await vi.waitFor(() => {
    expect(result.container.querySelectorAll(".data-table__sortable").length).toBe(4);
  });
  return result;
}

/** Helper: type into the search combobox */
async function typeInSearch(container: HTMLElement, text: string) {
  const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
  input.value = text;
  await fireEvent.input(input, { target: { value: text } });
  return input;
}

describe("ModelPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelPrices.mockResolvedValue(modelData);
  });

  it("renders Model Prices heading", () => {
    render(() => <ModelPrices />);
    expect(screen.getByText("Model Prices")).toBeDefined();
  });

  it("renders subtitle", () => {
    render(() => <ModelPrices />);
    expect(screen.getByText("What each AI model costs to use")).toBeDefined();
  });

  it("renders model count", async () => {
    const { container } = render(() => <ModelPrices />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("4 models");
    });
  });

  it("renders model names in table", async () => {
    const { container } = render(() => <ModelPrices />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("gpt-4o");
      expect(container.textContent).toContain("claude-3.5-sonnet");
    });
  });

  it("renders provider names", async () => {
    const { container } = render(() => <ModelPrices />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("OpenAI");
      expect(container.textContent).toContain("Anthropic");
    });
  });

  it("renders prices", async () => {
    const { container } = render(() => <ModelPrices />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("$2.50");
      expect(container.textContent).toContain("$10.00");
    });
  });

  it("has sortable column headers", async () => {
    const { container } = render(() => <ModelPrices />);
    await vi.waitFor(() => {
      const headers = container.querySelectorAll(".data-table__sortable");
      expect(headers.length).toBe(4);
    });
  });

  it("sorts when header clicked", async () => {
    const { container } = await renderAndWait();
    fireEvent.click(container.querySelectorAll(".data-table__sortable")[0]);
    // Should still contain both models
    expect(container.textContent).toContain("gpt-4o");
  });

  it("shows last updated time", async () => {
    const { container } = render(() => <ModelPrices />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Last updated:");
    });
  });

  it("shows loading skeleton", () => {
    mockGetModelPrices.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <ModelPrices />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("renders 0 models with empty data", async () => {
    mockGetModelPrices.mockResolvedValue({ models: [], lastSyncedAt: null });
    render(() => <ModelPrices />);
    expect(await screen.findByText("0 models")).toBeDefined();
  });
});

describe("ModelPrices - autocomplete filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelPrices.mockResolvedValue(modelData);
  });

  it("renders search input with combobox role", async () => {
    const { container } = await renderAndWait();
    const input = container.querySelector(".model-filter__search");
    expect(input).toBeDefined();
    expect(input?.getAttribute("role")).toBe("combobox");
  });

  it("does not show dropdown with fewer than 2 chars", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "g");
    expect(container.querySelector(".model-filter__dropdown")).toBeNull();
  });

  it("shows dropdown when typing 2+ matching chars", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "gpt");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
  });

  it("shows matching models in dropdown", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "gpt");
    await vi.waitFor(() => {
      const dropdown = container.querySelector(".model-filter__dropdown");
      expect(dropdown?.textContent).toContain("gpt-4o");
      expect(dropdown?.textContent).toContain("gpt-4o-mini");
    });
  });

  it("shows matching providers in dropdown", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      const dropdown = container.querySelector(".model-filter__dropdown");
      expect(dropdown?.textContent).toContain("OpenAI");
      expect(dropdown?.textContent).toContain("Providers");
    });
  });

  it("adds provider tag when clicking a provider suggestion", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const items = container.querySelectorAll(".model-filter__dropdown-item");
    // First item in Providers group should be OpenAI
    const openAIItem = Array.from(items).find((el) => el.textContent?.includes("OpenAI"));
    expect(openAIItem).toBeDefined();
    await fireEvent.click(openAIItem!);
    await vi.waitFor(() => {
      const tags = container.querySelectorAll(".model-filter__tag");
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toContain("OpenAI");
    });
  });

  it("filters table after selecting a provider", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const items = container.querySelectorAll(".model-filter__dropdown-item");
    const openAIItem = Array.from(items).find((el) => el.textContent?.includes("OpenAI"));
    await fireEvent.click(openAIItem!);
    await vi.waitFor(() => {
      // Should show filtered count
      expect(container.textContent).toContain("2 of 4 models");
      // Table should contain OpenAI models only
      expect(container.textContent).toContain("gpt-4o");
      expect(container.textContent).not.toContain("claude-3.5-sonnet");
      expect(container.textContent).not.toContain("gemini-2.5-pro");
    });
  });

  it("adds model tag when clicking a model suggestion", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "claude");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const items = container.querySelectorAll(".model-filter__dropdown-item");
    const claudeItem = Array.from(items).find((el) => el.textContent?.includes("claude-3.5-sonnet"));
    await fireEvent.click(claudeItem!);
    await vi.waitFor(() => {
      const tags = container.querySelectorAll(".model-filter__tag");
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toContain("claude-3.5-sonnet");
      expect(tags[0].textContent).toContain("Model:");
    });
  });

  it("removes tag when clicking the remove button", async () => {
    const { container } = await renderAndWait();
    // Add a provider tag
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const items = container.querySelectorAll(".model-filter__dropdown-item");
    const openAIItem = Array.from(items).find((el) => el.textContent?.includes("OpenAI"));
    await fireEvent.click(openAIItem!);
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(1);
    });
    // Remove it
    const removeBtn = container.querySelector(".model-filter__tag-remove")!;
    await fireEvent.click(removeBtn);
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(0);
      expect(container.textContent).toContain("4 models");
    });
  });

  it("clears all filters via Clear filters button", async () => {
    const { container } = await renderAndWait();
    // Add a provider tag
    await typeInSearch(container, "anth");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const items = container.querySelectorAll(".model-filter__dropdown-item");
    const anthropicItem = Array.from(items).find((el) => el.textContent?.includes("Anthropic"));
    await fireEvent.click(anthropicItem!);
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(1);
    });
    // Click "Clear filters"
    const clearBtn = container.querySelector(".model-filter__clear-all")!;
    await fireEvent.click(clearBtn);
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(0);
      expect(container.textContent).toContain("4 models");
    });
  });

  it("closes dropdown on Escape key", async () => {
    const { container } = await renderAndWait();
    const input = await typeInSearch(container, "gpt");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    await fireEvent.keyDown(input, { key: "Escape" });
    expect(container.querySelector(".model-filter__dropdown")).toBeNull();
  });

  it("navigates dropdown with arrow keys and selects with Enter", async () => {
    const { container } = await renderAndWait();
    const input = await typeInSearch(container, "gpt");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    // Arrow down to first item
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    // Verify highlight
    expect(container.querySelector(".model-filter__dropdown-item--highlighted")).not.toBeNull();
    // Enter to select
    await fireEvent.keyDown(input, { key: "Enter" });
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(1);
    });
  });

  it("removes last tag on Backspace when input is empty", async () => {
    const { container } = await renderAndWait();
    // Add a tag first
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const items = container.querySelectorAll(".model-filter__dropdown-item");
    const openAIItem = Array.from(items).find((el) => el.textContent?.includes("OpenAI"));
    await fireEvent.click(openAIItem!);
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(1);
    });
    // Now Backspace on empty input
    const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
    await fireEvent.keyDown(input, { key: "Backspace" });
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(0);
    });
  });

  it("shows empty state when all models are filtered out", async () => {
    const { container } = await renderAndWait();
    // Select Google provider (1 model), then add a model tag that doesn't belong to Google
    await typeInSearch(container, "goo");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const providerItems = container.querySelectorAll(".model-filter__dropdown-item");
    const googleItem = Array.from(providerItems).find((el) => el.textContent?.includes("Google"));
    await fireEvent.click(googleItem!);
    // Now add a model filter for a non-Google model
    await typeInSearch(container, "gpt");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const modelItems = container.querySelectorAll(".model-filter__dropdown-item");
    const gptItem = Array.from(modelItems).find((el) => el.textContent?.includes("gpt-4o-mini"));
    await fireEvent.click(gptItem!);
    // AND logic: Google provider + gpt-4o-mini model = no matches
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No models match your filters");
    });
  });

  it("does not show already-selected providers in dropdown", async () => {
    const { container } = await renderAndWait();
    // Select OpenAI
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const items = container.querySelectorAll(".model-filter__dropdown-item");
    const openAIItem = Array.from(items).find((el) => el.textContent?.includes("OpenAI"));
    await fireEvent.click(openAIItem!);
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".model-filter__tag").length).toBe(1);
    });
    // Search again - OpenAI should not appear
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      const dropdown = container.querySelector(".model-filter__dropdown");
      // Dropdown should not appear since OpenAI is already selected and models don't match "open"
      // (gpt-4o and gpt-4o-mini don't contain "open")
      expect(dropdown).toBeNull();
    });
  });

  it("renders provider icon as img for known providers", async () => {
    const { container } = await renderAndWait();
    await typeInSearch(container, "open");
    await vi.waitFor(() => {
      expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
    });
    const iconImg = container.querySelector(".model-filter__dropdown .model-filter__provider-icon");
    expect(iconImg).not.toBeNull();
    expect(iconImg?.tagName.toLowerCase()).toBe("img");
    expect((iconImg as HTMLImageElement)?.src).toContain("/icons/providers/openai.svg");
  });

  it("shows group labels in dropdown", async () => {
    const { container } = await renderAndWait();
    // "go" matches Google provider and no models
    await typeInSearch(container, "goo");
    await vi.waitFor(() => {
      const labels = container.querySelectorAll(".model-filter__dropdown-label");
      expect(labels.length).toBeGreaterThan(0);
      expect(labels[0].textContent).toBe("Providers");
    });
  });
});
