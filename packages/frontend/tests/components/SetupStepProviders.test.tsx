import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

import SetupStepProviders from "../../src/components/SetupStepProviders";

describe("SetupStepProviders", () => {
  const onGoToRouting = vi.fn();

  it("renders heading", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.querySelector("h3")?.textContent).toBe("Connect your models");
  });

  it("renders description about needing a provider", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.textContent).toContain("at least one LLM provider");
  });

  it("renders warning about requests failing without providers", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.textContent).toContain("will fail");
  });

  it("mentions manifest/auto in the warning", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.textContent).toContain("manifest/auto");
  });

  it("renders go to routing button", () => {
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
