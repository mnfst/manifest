import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

vi.mock("manifest-shared", () => ({
  AGENT_CATEGORIES: ["personal", "app"],
  CATEGORY_LABELS: {
    personal: "Personal AI Agent",
    app: "App AI SDK",
  },
  PLATFORM_LABELS: {
    openclaw: "OpenClaw",
    hermes: "Hermes Agent",
    "openai-sdk": "OpenAI SDK",
    "vercel-ai-sdk": "Vercel AI SDK",
    langchain: "LangChain",
    curl: "cURL",
    other: "Other",
  },
  PLATFORMS_BY_CATEGORY: {
    personal: ["openclaw", "hermes", "other"],
    app: ["openai-sdk", "vercel-ai-sdk", "langchain", "other"],
  },
  PLATFORM_ICONS: {
    openclaw: "/icons/openclaw.png",
    hermes: "/icons/hermes.png",
    "openai-sdk": "/icons/providers/openai.svg",
    "vercel-ai-sdk": "/icons/vercel.svg",
    langchain: "/icons/langchain.svg",
  },
}));

import AgentTypeGrid from "../../src/components/AgentTypeGrid";

describe("AgentTypeGrid", () => {
  const defaultProps = {
    category: "personal" as string | null,
    platform: "openclaw" as string | null,
    onCategoryChange: vi.fn(),
    onPlatformChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders inline grid with both category groups", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const labels = container.querySelectorAll(".agent-type-select__group-label");
    expect(labels).toHaveLength(2);
    expect(labels[0].textContent).toContain("Personal AI Agent");
    expect(labels[1].textContent).toContain("App AI SDK");
  });

  it("renders all platform options from both categories", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const options = container.querySelectorAll(".agent-type-select__option");
    expect(options).toHaveLength(7);
  });

  it("renders two columns", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const columns = container.querySelectorAll(".agent-type-select__column");
    expect(columns).toHaveLength(2);
  });

  it("marks selected option", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const selected = container.querySelectorAll(".agent-type-select__option--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("OpenClaw");
  });

  it("calls onCategoryChange and onPlatformChange on click", () => {
    const onCategoryChange = vi.fn();
    const onPlatformChange = vi.fn();
    const { container } = render(() => (
      <AgentTypeGrid
        {...defaultProps}
        onCategoryChange={onCategoryChange}
        onPlatformChange={onPlatformChange}
      />
    ));
    const options = container.querySelectorAll(".agent-type-select__option");
    fireEvent.click(options[3]); // OpenAI SDK (app category)
    expect(onCategoryChange).toHaveBeenCalledWith("app");
    expect(onPlatformChange).toHaveBeenCalledWith("openai-sdk");
  });

  it("shows platform icons", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const icons = container.querySelectorAll(".agent-type-select__option-icon");
    expect(icons.length).toBeGreaterThanOrEqual(5);
    expect(icons[0].getAttribute("src")).toBe("/icons/openclaw.png");
  });

  it("uses other-agent.svg for personal Other", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const options = container.querySelectorAll(".agent-type-select__option");
    const icon = options[2].querySelector(".agent-type-select__option-icon");
    expect(icon!.getAttribute("src")).toBe("/icons/other-agent.svg");
  });

  it("uses other.svg for app Other", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const options = container.querySelectorAll(".agent-type-select__option");
    const icon = options[6].querySelector(".agent-type-select__option-icon");
    expect(icon!.getAttribute("src")).toBe("/icons/other.svg");
  });

  it("disables buttons when disabled prop is true", () => {
    const { container } = render(() => (
      <AgentTypeGrid {...defaultProps} disabled={true} />
    ));
    const options = container.querySelectorAll(".agent-type-select__option") as NodeListOf<HTMLButtonElement>;
    for (const opt of options) {
      expect(opt.disabled).toBe(true);
    }
  });

  it("has inline modifier class", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    expect(container.querySelector(".agent-type-select__dropdown--inline")).not.toBeNull();
  });

  it("sets aria-selected on selected option", () => {
    const { container } = render(() => <AgentTypeGrid {...defaultProps} />);
    const options = container.querySelectorAll('[role="option"]');
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[1].getAttribute("aria-selected")).toBe("false");
  });

  it("selects app Other correctly", () => {
    const onCategoryChange = vi.fn();
    const onPlatformChange = vi.fn();
    const { container } = render(() => (
      <AgentTypeGrid
        {...defaultProps}
        category="app"
        platform="other"
        onCategoryChange={onCategoryChange}
        onPlatformChange={onPlatformChange}
      />
    ));
    const selected = container.querySelectorAll(".agent-type-select__option--selected");
    expect(selected).toHaveLength(1);
    // app Other is at index 6
    const options = container.querySelectorAll(".agent-type-select__option");
    expect(options[6].classList.contains("agent-type-select__option--selected")).toBe(true);
  });
});
