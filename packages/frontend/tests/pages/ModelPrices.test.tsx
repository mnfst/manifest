import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({}),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/api.js", () => ({
  getModelPrices: vi.fn().mockResolvedValue({ models: [], lastSyncedAt: null }),
}));

import ModelPrices from "../../src/pages/ModelPrices";

describe("ModelPrices", () => {
  it("renders Model Prices heading", () => {
    render(() => <ModelPrices />);
    expect(screen.getByText("Model Prices")).toBeDefined();
  });

  it("renders subtitle", () => {
    render(() => <ModelPrices />);
    expect(screen.getByText("What each AI model costs to use")).toBeDefined();
  });

  it("renders 0 models count when data is empty", async () => {
    render(() => <ModelPrices />);
    expect(await screen.findByText("0 models")).toBeDefined();
  });
});
