import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

const mockGetAgentKey = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgentKey: (...args: unknown[]) => mockGetAgentKey(...args),
}));

vi.mock("../../src/components/FrameworkSnippets.jsx", () => ({
  default: (props: {
    customHeaders?: Record<string, string>;
    baseUrl: string;
    apiKey?: string | null;
    keyPrefix?: string | null;
    model?: string;
  }) => (
    <div data-testid="framework-snippets">
      <div data-testid="snippets-base-url">{props.baseUrl}</div>
      <div data-testid="snippets-custom-headers">
        {JSON.stringify(props.customHeaders ?? null)}
      </div>
      <div data-testid="snippets-model">{props.model ?? "auto"}</div>
      <div data-testid="snippets-api-key">{props.apiKey ?? "null"}</div>
      <div data-testid="snippets-key-prefix">{props.keyPrefix ?? "null"}</div>
    </div>
  ),
}));

import HeaderTierSnippetModal from "../../src/components/HeaderTierSnippetModal";
import type { HeaderTier } from "../../src/services/api/header-tiers";

const baseTier: HeaderTier = {
  id: "ht-1",
  agent_id: "agent-1",
  name: "Premium",
  header_key: "x-manifest-tier",
  header_value: "premium",
  badge_color: "indigo",
  sort_order: 0,
  enabled: true,
  override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
  fallback_routes: null,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
};

describe("HeaderTierSnippetModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentKey.mockResolvedValue({ apiKey: "mnfst_abc", keyPrefix: "mnfst_abc" });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "localhost", origin: "http://localhost:3001" },
    });
  });

  it("renders the tier name in the modal title", () => {
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    const title = container.querySelector("#header-tier-snippet-title");
    expect(title?.textContent).toContain("Premium");
  });

  it("passes the tier model alias to FrameworkSnippets", () => {
    const { getByTestId } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    expect(getByTestId("snippets-model").textContent).toBe("premium");
  });

  it("renders model alias and primary model in the description", () => {
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    const desc = container.querySelector(".modal-card__desc");
    expect(desc?.textContent).toContain('model: "premium"');
    expect(desc?.textContent).toContain("gpt-4o");
  });

  it("notes when no primary model is assigned", () => {
    const tier = { ...baseTier, override_route: null };
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={tier} onClose={vi.fn()} />
    ));
    expect(container.querySelector(".modal-card__desc")?.textContent).toContain(
      "assign a primary model",
    );
  });

  it("omits customHeaders when header rule is not set", () => {
    const tier = { ...baseTier, header_key: null, header_value: null };
    const { getByTestId } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={tier} onClose={vi.fn()} />
    ));
    expect(getByTestId("snippets-custom-headers").textContent).toBe("{}");
  });

  it("passes the tier's header_key/header_value as customHeaders to FrameworkSnippets", () => {
    const { getByTestId } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    const headers = JSON.parse(getByTestId("snippets-custom-headers").textContent ?? "{}") as Record<
      string,
      string
    >;
    expect(headers).toEqual({ "x-manifest-tier": "premium" });
  });

  it("uses window.location.origin + /v1 as the base URL on non-app.manifest.build hosts", () => {
    const { getByTestId } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    expect(getByTestId("snippets-base-url").textContent).toBe("http://localhost:3001/v1");
  });

  it("uses the production URL on app.manifest.build", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "app.manifest.build", origin: "https://app.manifest.build" },
    });
    const { getByTestId } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    expect(getByTestId("snippets-base-url").textContent).toBe("https://app.manifest.build/v1");
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={onClose} />
    ));
    const closeBtn = container.querySelector(".modal__close") as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Done button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={onClose} />
    ));
    const doneBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Done",
    ) as HTMLButtonElement;
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the overlay is clicked but not the modal card", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay") as HTMLElement;
    // simulate click on the overlay itself (target === currentTarget)
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal card", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={onClose} />
    ));
    const card = container.querySelector(".modal-card") as HTMLElement;
    fireEvent.click(card);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key press", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay") as HTMLElement;
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for non-Escape keys", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay") as HTMLElement;
    fireEvent.keyDown(overlay, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("threads apiKey and keyPrefix from getAgentKey through to FrameworkSnippets", async () => {
    const { findByTestId } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    expect((await findByTestId("snippets-api-key")).textContent).toBe("mnfst_abc");
    expect((await findByTestId("snippets-key-prefix")).textContent).toBe("mnfst_abc");
  });

  it("threads null apiKey when getAgentKey resolves with no keys", async () => {
    mockGetAgentKey.mockResolvedValue({ apiKey: null, keyPrefix: null });
    const { findByTestId } = render(() => (
      <HeaderTierSnippetModal agentName="demo" tier={baseTier} onClose={vi.fn()} />
    ));
    expect((await findByTestId("snippets-api-key")).textContent).toBe("null");
    expect((await findByTestId("snippets-key-prefix")).textContent).toBe("null");
  });
});
