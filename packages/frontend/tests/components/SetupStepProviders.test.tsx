import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

import SetupStepProviders from "../../src/components/SetupStepProviders";

describe("SetupStepProviders", () => {
  const onGoToRouting = vi.fn();

  it("renders heading and description", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.querySelector("h3")?.textContent).toBe("Set up routing");
    expect(container.textContent).toContain("Add your API keys");
  });

  it("renders set up routing button", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    const btn = container.querySelector(".btn");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("Go to routing");
  });

  it("calls onGoToRouting when button clicked", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    const btn = container.querySelector(".btn")!;
    fireEvent.click(btn);
    expect(onGoToRouting).toHaveBeenCalled();
  });
});
