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
  ],
  lastSyncedAt: "2026-02-18T10:00:00Z",
};

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
      expect(container.textContent).toContain("2 models");
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
    const { container } = render(() => <ModelPrices />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".data-table__sortable").length).toBe(4);
    });
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
