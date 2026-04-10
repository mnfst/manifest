import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("manifest-shared", () => ({
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

import AgentTypePicker from "../../src/components/AgentTypePicker";

describe("AgentTypePicker", () => {
  const defaultProps = {
    category: null as string | null,
    platform: null as string | null,
    onCategoryChange: vi.fn(),
    onPlatformChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders category tab list", () => {
    const { container } = render(() => <AgentTypePicker {...defaultProps} />);
    const group = container.querySelector('[role="tablist"][aria-label="Agent type"]');
    expect(group).not.toBeNull();
  });

  it("renders both category options", () => {
    const { container } = render(() => <AgentTypePicker {...defaultProps} />);
    expect(container.textContent).toContain("Personal AI Agent");
    expect(container.textContent).toContain("App AI SDK");
  });

  it("renders tab buttons for categories", () => {
    const { container } = render(() => <AgentTypePicker {...defaultProps} />);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain("Personal AI Agent");
    expect(tabs[1].textContent).toContain("App AI SDK");
  });

  it("marks selected category tab as active", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("applies active class to chosen category tab", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="app" />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0].classList.contains("panel__tab--active")).toBe(false);
    expect(tabs[1].classList.contains("panel__tab--active")).toBe(true);
  });

  it("calls onCategoryChange when category tab clicked", () => {
    const onCategoryChange = vi.fn();
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} onCategoryChange={onCategoryChange} />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    fireEvent.click(tabs[0]);
    expect(onCategoryChange).toHaveBeenCalledWith("personal");
  });

  it("calls onCategoryChange with app when app tab clicked", () => {
    const onCategoryChange = vi.fn();
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} onCategoryChange={onCategoryChange} />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    fireEvent.click(tabs[1]);
    expect(onCategoryChange).toHaveBeenCalledWith("app");
  });

  it("does not show platforms when no category selected", () => {
    const { container } = render(() => <AgentTypePicker {...defaultProps} />);
    expect(container.querySelector('[role="radiogroup"][aria-label="Platform"]')).toBeNull();
  });

  it("shows personal platforms when personal category selected", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" />
    ));
    const platformGroup = container.querySelector('[role="radiogroup"][aria-label="Platform"]');
    expect(platformGroup).not.toBeNull();
    expect(platformGroup!.textContent).toContain("OpenClaw");
    expect(platformGroup!.textContent).toContain("Hermes Agent");
    expect(platformGroup!.textContent).toContain("Other");
  });

  it("shows app platforms when app category selected", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="app" />
    ));
    const platformGroup = container.querySelector('[role="radiogroup"][aria-label="Platform"]');
    expect(platformGroup).not.toBeNull();
    expect(platformGroup!.textContent).toContain("OpenAI SDK");
    expect(platformGroup!.textContent).toContain("Vercel AI SDK");
    expect(platformGroup!.textContent).toContain("LangChain");
    expect(platformGroup!.textContent).toContain("Other");
  });

  it("renders platform radio inputs for personal category", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" />
    ));
    const radios = container.querySelectorAll('input[name="agent-platform"]');
    expect(radios).toHaveLength(3);
    expect(radios[0].getAttribute("value")).toBe("openclaw");
    expect(radios[1].getAttribute("value")).toBe("hermes");
    expect(radios[2].getAttribute("value")).toBe("other");
  });

  it("marks selected platform radio as checked", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" platform="openclaw" />
    ));
    const radios = container.querySelectorAll('input[name="agent-platform"]') as NodeListOf<HTMLInputElement>;
    expect(radios[0].checked).toBe(true);
    expect(radios[1].checked).toBe(false);
  });

  it("applies selected class to chosen platform", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" platform="hermes" />
    ));
    const labels = container.querySelectorAll(".agent-type-picker__platform");
    expect(labels[0].classList.contains("agent-type-picker__platform--selected")).toBe(false);
    expect(labels[1].classList.contains("agent-type-picker__platform--selected")).toBe(true);
  });

  it("calls onPlatformChange when platform radio clicked", () => {
    const onPlatformChange = vi.fn();
    const { container } = render(() => (
      <AgentTypePicker
        {...defaultProps}
        category="personal"
        onPlatformChange={onPlatformChange}
      />
    ));
    const radios = container.querySelectorAll('input[name="agent-platform"]');
    fireEvent.change(radios[0]);
    expect(onPlatformChange).toHaveBeenCalledWith("openclaw");
  });

  it("shows platform icons for platforms that have icons", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" />
    ));
    const icons = container.querySelectorAll(".agent-type-picker__platform-icon");
    expect(icons.length).toBeGreaterThanOrEqual(2); // openclaw and hermes have icons
    expect(icons[0].getAttribute("src")).toBe("/icons/openclaw.png");
    expect(icons[1].getAttribute("src")).toBe("/icons/hermes.png");
  });

  it("shows fallback icon for other platform", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" />
    ));
    const labels = container.querySelectorAll(".agent-type-picker__platform");
    // "other" platform gets a fallback icon from iconFor()
    const otherLabel = labels[2];
    const icon = otherLabel.querySelector(".agent-type-picker__platform-icon");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("src")).toBe("/icons/other-agent.svg");
  });

  it("disables category tabs when disabled prop is true", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} disabled={true} />
    ));
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    expect(tabs[0].disabled).toBe(true);
    expect(tabs[1].disabled).toBe(true);
  });

  it("disables platform radios when disabled prop is true", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" disabled={true} />
    ));
    const radios = container.querySelectorAll('input[name="agent-platform"]') as NodeListOf<HTMLInputElement>;
    expect(radios[0].disabled).toBe(true);
    expect(radios[1].disabled).toBe(true);
  });

  it("does not disable radios when disabled is false", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="personal" disabled={false} />
    ));
    const radios = container.querySelectorAll('input[name="agent-platform"]') as NodeListOf<HTMLInputElement>;
    expect(radios[0].disabled).toBe(false);
  });

  it("shows app platform icons", () => {
    const { container } = render(() => (
      <AgentTypePicker {...defaultProps} category="app" />
    ));
    const icons = container.querySelectorAll(".agent-type-picker__platform-icon");
    expect(icons.length).toBeGreaterThanOrEqual(3); // openai-sdk, vercel, langchain
  });

  it("calls onPlatformChange with app platform value", () => {
    const onPlatformChange = vi.fn();
    const { container } = render(() => (
      <AgentTypePicker
        {...defaultProps}
        category="app"
        onPlatformChange={onPlatformChange}
      />
    ));
    const radios = container.querySelectorAll('input[name="agent-platform"]');
    fireEvent.change(radios[1]); // vercel-ai-sdk
    expect(onPlatformChange).toHaveBeenCalledWith("vercel-ai-sdk");
  });
});
