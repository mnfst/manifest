import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

import SetupStepProviders from "../../src/components/SetupStepProviders";

describe("SetupStepProviders", () => {
  const onGoToRouting = vi.fn();

  it("renders heading", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.querySelector("h3")?.textContent).toBe("Connect your LLM providers");
  });

  it("renders description about routing", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.textContent).toContain("routes each request to the best model");
  });

  it("renders warning about requests failing without providers", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.textContent).toContain("will return an error");
  });

  it("mentions manifest/auto", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.textContent).toContain("manifest/auto");
  });

  it("renders connect a provider button", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    const btn = container.querySelector(".btn--primary");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("Connect a provider");
  });

  it("calls onGoToRouting when button clicked", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    const btn = container.querySelector(".btn--primary")!;
    fireEvent.click(btn);
    expect(onGoToRouting).toHaveBeenCalled();
  });

  it("shows skip button when onSkip provided", () => {
    const onSkip = vi.fn();
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} onSkip={onSkip} />
    ));
    const skipBtn = container.querySelector(".btn--ghost");
    expect(skipBtn).not.toBeNull();
    expect(skipBtn?.textContent).toContain("I'll do this later");
  });

  it("calls onSkip when skip button clicked", () => {
    const onSkip = vi.fn();
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} onSkip={onSkip} />
    ));
    fireEvent.click(container.querySelector(".btn--ghost")!);
    expect(onSkip).toHaveBeenCalled();
  });

  it("does not show skip button when onSkip not provided", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.querySelector(".btn--ghost")).toBeNull();
  });

  it("uses setup-step__heading class", () => {
    const { container } = render(() => (
      <SetupStepProviders agentName="test-agent" onGoToRouting={onGoToRouting} />
    ));
    expect(container.querySelector(".setup-step__heading")).not.toBeNull();
  });
});
