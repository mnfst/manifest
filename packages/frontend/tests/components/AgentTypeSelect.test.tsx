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

import AgentTypeSelect from "../../src/components/AgentTypeSelect";

describe("AgentTypeSelect", () => {
  const defaultProps = {
    category: "personal" as string | null,
    platform: "openclaw" as string | null,
    onCategoryChange: vi.fn(),
    onPlatformChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button with caret", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    const trigger = container.querySelector(".agent-type-select__trigger");
    expect(trigger).not.toBeNull();
    expect(trigger!.querySelector(".agent-type-select__caret")).not.toBeNull();
  });

  it("shows selected platform icon in trigger", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    const icon = container.querySelector(".agent-type-select__trigger-icon");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("src")).toBe("/icons/openclaw.png");
  });

  it("does not show dropdown by default", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    expect(container.querySelector(".agent-type-select__dropdown")).toBeNull();
  });

  it("opens dropdown on trigger click", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    expect(container.querySelector(".agent-type-select__dropdown")).not.toBeNull();
  });

  it("shows both category group labels in dropdown", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const labels = container.querySelectorAll(".agent-type-select__group-label");
    expect(labels).toHaveLength(2);
    expect(labels[0].textContent).toContain("Personal AI Agent");
    expect(labels[1].textContent).toContain("App AI SDK");
  });

  it("shows all platforms from both categories in dropdown", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const options = container.querySelectorAll(".agent-type-select__option");
    // personal: openclaw, hermes, other; app: openai-sdk, vercel-ai-sdk, langchain, other = 7
    expect(options).toHaveLength(7);
  });

  it("shows platform names in options", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const dropdown = container.querySelector(".agent-type-select__dropdown")!;
    expect(dropdown.textContent).toContain("OpenClaw");
    expect(dropdown.textContent).toContain("Hermes Agent");
    expect(dropdown.textContent).toContain("OpenAI SDK");
    expect(dropdown.textContent).toContain("Vercel AI SDK");
    expect(dropdown.textContent).toContain("LangChain");
  });

  it("shows platform icons in options", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const icons = container.querySelectorAll(".agent-type-select__option-icon");
    expect(icons.length).toBeGreaterThanOrEqual(5);
    expect(icons[0].getAttribute("src")).toBe("/icons/openclaw.png");
    expect(icons[1].getAttribute("src")).toBe("/icons/hermes.png");
  });

  it("marks selected option", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const selected = container.querySelectorAll(".agent-type-select__option--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("OpenClaw");
  });

  it("calls onCategoryChange and onPlatformChange on option click", () => {
    const onCategoryChange = vi.fn();
    const onPlatformChange = vi.fn();
    const { container } = render(() => (
      <AgentTypeSelect
        {...defaultProps}
        onCategoryChange={onCategoryChange}
        onPlatformChange={onPlatformChange}
      />
    ));
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const options = container.querySelectorAll(".agent-type-select__option");
    // Click "Hermes Agent" (index 1, personal category)
    fireEvent.click(options[1]);
    expect(onCategoryChange).toHaveBeenCalledWith("personal");
    expect(onPlatformChange).toHaveBeenCalledWith("hermes");
  });

  it("calls with app category when app platform selected", () => {
    const onCategoryChange = vi.fn();
    const onPlatformChange = vi.fn();
    const { container } = render(() => (
      <AgentTypeSelect
        {...defaultProps}
        onCategoryChange={onCategoryChange}
        onPlatformChange={onPlatformChange}
      />
    ));
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const options = container.querySelectorAll(".agent-type-select__option");
    // Click "OpenAI SDK" (index 3, app category: after openclaw, hermes, other)
    fireEvent.click(options[3]);
    expect(onCategoryChange).toHaveBeenCalledWith("app");
    expect(onPlatformChange).toHaveBeenCalledWith("openai-sdk");
  });

  it("closes dropdown after selection", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    expect(container.querySelector(".agent-type-select__dropdown")).not.toBeNull();
    const options = container.querySelectorAll(".agent-type-select__option");
    fireEvent.click(options[0]);
    expect(container.querySelector(".agent-type-select__dropdown")).toBeNull();
  });

  it("closes dropdown on Escape key", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    expect(container.querySelector(".agent-type-select__dropdown")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".agent-type-select__dropdown")).toBeNull();
  });

  it("closes dropdown on click outside", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    expect(container.querySelector(".agent-type-select__dropdown")).not.toBeNull();
    fireEvent.click(document.body);
    expect(container.querySelector(".agent-type-select__dropdown")).toBeNull();
  });

  it("disables trigger when disabled prop is true", () => {
    const { container } = render(() => (
      <AgentTypeSelect {...defaultProps} disabled={true} />
    ));
    const trigger = container.querySelector(".agent-type-select__trigger") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });

  it("shows other-agent.svg for personal other", () => {
    const { container } = render(() => (
      <AgentTypeSelect {...defaultProps} category="personal" platform="other" />
    ));
    const icon = container.querySelector(".agent-type-select__trigger-icon");
    expect(icon!.getAttribute("src")).toBe("/icons/other-agent.svg");
  });

  it("shows other.svg for app other", () => {
    const { container } = render(() => (
      <AgentTypeSelect {...defaultProps} category="app" platform="other" />
    ));
    const icon = container.querySelector(".agent-type-select__trigger-icon");
    expect(icon!.getAttribute("src")).toBe("/icons/other.svg");
  });

  it("shows Other in both personal and app groups", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const options = container.querySelectorAll(".agent-type-select__option");
    // personal other at index 2, app other at index 6
    expect(options[2].textContent).toContain("Other");
    expect(options[6].textContent).toContain("Other");
  });

  it("uses different icons for personal other vs app other in dropdown", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const options = container.querySelectorAll(".agent-type-select__option");
    const personalOtherIcon = options[2].querySelector(".agent-type-select__option-icon");
    const appOtherIcon = options[6].querySelector(".agent-type-select__option-icon");
    expect(personalOtherIcon!.getAttribute("src")).toBe("/icons/other-agent.svg");
    expect(personalOtherIcon!.getAttribute("src")).not.toBe(appOtherIcon!.getAttribute("src"));
  });

  it("sets aria-expanded on trigger", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    const trigger = container.querySelector(".agent-type-select__trigger")!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("sets aria-haspopup on trigger", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    const trigger = container.querySelector(".agent-type-select__trigger")!;
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
  });

  it("sets role listbox on dropdown", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const dropdown = container.querySelector(".agent-type-select__dropdown");
    expect(dropdown!.getAttribute("role")).toBe("listbox");
  });

  it("sets role option on each platform option", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(7);
  });

  it("sets aria-selected on selected option", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    fireEvent.click(container.querySelector(".agent-type-select__trigger")!);
    const options = container.querySelectorAll('[role="option"]');
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[1].getAttribute("aria-selected")).toBe("false");
  });

  it("toggles dropdown on repeated trigger clicks", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    const trigger = container.querySelector(".agent-type-select__trigger")!;
    fireEvent.click(trigger);
    expect(container.querySelector(".agent-type-select__dropdown")).not.toBeNull();
    fireEvent.click(trigger);
    expect(container.querySelector(".agent-type-select__dropdown")).toBeNull();
  });

  it("applies open class to trigger when dropdown is open", () => {
    const { container } = render(() => <AgentTypeSelect {...defaultProps} />);
    const trigger = container.querySelector(".agent-type-select__trigger")!;
    expect(trigger.classList.contains("agent-type-select__trigger--open")).toBe(false);
    fireEvent.click(trigger);
    expect(trigger.classList.contains("agent-type-select__trigger--open")).toBe(true);
  });

  it("shows fallback icon when no category/platform selected", () => {
    const { container } = render(() => (
      <AgentTypeSelect {...defaultProps} category={null} platform={null} />
    ));
    const icon = container.querySelector(".agent-type-select__trigger-icon");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("src")).toBe("/icons/other.svg");
  });
});
