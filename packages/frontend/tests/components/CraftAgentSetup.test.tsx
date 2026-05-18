import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import CraftAgentSetup from "../../src/components/CraftAgentSetup";

describe("CraftAgentSetup", () => {
  const baseProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: "http://localhost:3001/v1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Manifest preset instruction", () => {
    const { container } = render(() => <CraftAgentSetup {...baseProps} />);
    expect(container.textContent).toContain("Manifest");
    expect(container.textContent).toContain("provider preset");
    expect(container.textContent).toContain("auto");
  });

  it("renders the API key", () => {
    const { container } = render(() => <CraftAgentSetup {...baseProps} />);
    expect(container.textContent).toContain("mnfst_YOUR_KEY");
  });

  it("masks the API key when only a prefix is available", () => {
    const { container } = render(() => (
      <CraftAgentSetup {...baseProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("mnfst_abc...");
    expect(container.querySelector('[aria-label="Reveal API key"]')).toBeNull();
    expect(container.querySelector('[aria-label="Hide API key"]')).toBeNull();
  });

  it("toggles the API key reveal when the eye button is clicked", () => {
    const { container } = render(() => (
      <CraftAgentSetup {...baseProps} apiKey="mnfst_full_secret_value" keyPrefix="mnfst_full" />
    ));
    expect(container.textContent).toContain("mnfst_full...");
    expect(container.textContent).not.toContain("mnfst_full_secret_value");

    const reveal = container.querySelector('[aria-label="Reveal API key"]') as HTMLButtonElement;
    expect(reveal).not.toBeNull();
    fireEvent.click(reveal);
    expect(container.textContent).toContain("mnfst_full_secret_value");

    const hide = container.querySelector('[aria-label="Hide API key"]') as HTMLButtonElement;
    expect(hide).not.toBeNull();
    fireEvent.click(hide);
    expect(container.textContent).not.toContain("mnfst_full_secret_value");
  });

  it("copy button always uses the real key", () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    const { container } = render(() => (
      <CraftAgentSetup {...baseProps} apiKey="mnfst_full_secret_value" keyPrefix="mnfst_full" />
    ));
    const copyButton = container.querySelector('button[aria-label*="Copy" i]') as HTMLButtonElement
      | null;
    expect(copyButton).not.toBeNull();
    fireEvent.click(copyButton!);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("mnfst_full_secret_value");
  });

  it("renders inside a setup-agents-card", () => {
    const { container } = render(() => <CraftAgentSetup {...baseProps} />);
    expect(container.querySelector(".setup-agents-card")).not.toBeNull();
  });
});
