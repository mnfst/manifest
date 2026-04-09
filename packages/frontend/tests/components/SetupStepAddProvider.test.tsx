import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import SetupStepAddProvider from "../../src/components/SetupStepAddProvider";

describe("SetupStepAddProvider", () => {
  const defaultProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: "http://localhost:3001/v1",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("renders heading", () => {
    render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(screen.getByText("Connect your agent to Manifest")).toBeDefined();
  });

  it("shows description with auto model", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("auto");
    expect(container.textContent).toContain("Point your agent");
  });

  it("renders Agents and Toolkits segmented tabs", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const segment = container.querySelector(".setup-segment");
    expect(segment).not.toBeNull();
    const buttons = segment!.querySelectorAll(".setup-segment__btn");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe("Agents");
    expect(buttons[1].textContent).toBe("Toolkits");
  });

  it("defaults to Agents tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const activeBtn = container.querySelector(".setup-segment__btn--active");
    expect(activeBtn).not.toBeNull();
    expect(activeBtn!.textContent).toBe("Agents");
  });

  it("shows OpenClaw and Hermes Agent tabs inside Agents", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const agentTabs = container.querySelectorAll(".panel__tab");
    expect(agentTabs).toHaveLength(2);
    expect(agentTabs[0].textContent).toContain("OpenClaw");
    expect(agentTabs[1].textContent).toContain("Hermes Agent");
  });

  it("defaults to OpenClaw agent tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const agentTabs = container.querySelectorAll(".panel__tab");
    expect(agentTabs[0].classList.contains("panel__tab--active")).toBe(true);
  });

  it("shows OpenClaw logo in agent tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const icon = container.querySelector(".panel__tab-icon");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("src")).toBe("/icons/openclaw.png");
  });

  it("shows Agents card with title when OpenClaw selected", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".setup-agents-card")).not.toBeNull();
    expect(container.textContent).toContain("Add Manifest as a provider");
  });

  it("shows coming soon when Hermes Agent selected", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const agentTabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(agentTabs[1]); // Hermes Agent
    expect(container.querySelector(".setup-agents-coming-soon")).not.toBeNull();
    expect(container.textContent).toContain("Coming soon");
    expect(container.querySelector(".setup-agents-card")).toBeNull();
  });

  it("switches back to OpenClaw from Hermes Agent", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const agentTabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(agentTabs[1]); // Hermes
    fireEvent.click(agentTabs[0]); // OpenClaw
    expect(container.querySelector(".setup-agents-card")).not.toBeNull();
    expect(container.querySelector(".setup-agents-coming-soon")).toBeNull();
  });

  it("shows manifest/auto in agents description", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("manifest/auto");
  });

  it("shows CLI and Interactive wizard sub-tabs", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const fullSegment = container.querySelector(".setup-segment--full");
    expect(fullSegment).not.toBeNull();
    const btns = fullSegment!.querySelectorAll(".setup-segment__btn");
    expect(btns).toHaveLength(2);
    expect(btns[0].textContent).toBe("CLI configuration");
    expect(btns[1].textContent).toBe("Interactive wizard");
  });

  it("defaults to CLI configuration sub-tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const fullSegment = container.querySelector(".setup-segment--full");
    const btns = fullSegment!.querySelectorAll(".setup-segment__btn");
    expect(btns[0].classList.contains("setup-segment__btn--active")).toBe(true);
  });

  it("shows CLI commands on CLI sub-tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("openclaw config set");
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("shows CLI description", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Set the provider config and default model directly via CLI commands");
  });

  it("switches to Interactive wizard sub-tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const fullSegment = container.querySelector(".setup-segment--full");
    const btns = fullSegment!.querySelectorAll(".setup-segment__btn");
    fireEvent.click(btns[1]); // Interactive wizard
    expect(container.textContent).toContain("openclaw onboard");
    expect(container.textContent).toContain("Custom Provider");
  });

  it("shows onboard fields on wizard sub-tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const fullSegment = container.querySelector(".setup-segment--full");
    fireEvent.click(fullSegment!.querySelectorAll(".setup-segment__btn")[1]);
    const fields = container.querySelectorAll(".setup-onboard-fields__row");
    expect(fields).toHaveLength(5);
    expect(fields[0].textContent).toContain("API Base URL");
    expect(fields[0].textContent).toContain("http://localhost:3001/v1");
    expect(fields[1].textContent).toContain("API Key");
    expect(fields[2].textContent).toContain("Endpoint compatibility");
    expect(fields[2].textContent).toContain("OpenAI-compatible");
    expect(fields[3].textContent).toContain("Model ID");
    expect(fields[3].textContent).toContain("auto");
    expect(fields[4].textContent).toContain("Endpoint ID");
    expect(fields[4].textContent).toContain("manifest");
  });

  it("shows eye toggle on CLI sub-tab when apiKey provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret" keyPrefix="mnfst_abc" />
    ));
    expect(container.querySelector('[aria-label="Reveal API key"]')).not.toBeNull();
  });

  it("reveals key in CLI commands when eye toggle clicked", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret" keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("mnfst_abc...");
    expect(container.textContent).not.toContain("mnfst_secret");
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_secret");
  });

  it("hides key again on second CLI eye toggle click", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret" keyPrefix="mnfst_abc" />
    ));
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    fireEvent.click(container.querySelector('[aria-label="Hide API key"]')!);
    expect(container.textContent).not.toContain("mnfst_secret");
  });

  it("does not show eye toggle on CLI when no apiKey", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.querySelector('[aria-label="Reveal API key"]')).toBeNull();
  });

  it("disables CLI copy button when key is hidden", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret" keyPrefix="mnfst_abc" />
    ));
    const copyBtns = container.querySelectorAll(".modal-terminal__copy");
    const cliCopy = Array.from(copyBtns).find(b => b.getAttribute("aria-label") === "Copy disabled");
    expect(cliCopy).not.toBeNull();
    expect(cliCopy!.hasAttribute("disabled")).toBe(true);
  });

  it("enables CLI copy button when key is revealed", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret" keyPrefix="mnfst_abc" />
    ));
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    const copyBtns = container.querySelectorAll(".modal-terminal__copy");
    const cliCopy = Array.from(copyBtns).find(b => b.getAttribute("aria-label") === "Copy to clipboard");
    expect(cliCopy).not.toBeNull();
    expect(cliCopy!.hasAttribute("disabled")).toBe(false);
  });

  it("shows eye toggle on wizard API Key field when apiKey provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_wiz" keyPrefix="mnfst_wi" />
    ));
    const fullSegment = container.querySelector(".setup-segment--full");
    fireEvent.click(fullSegment!.querySelectorAll(".setup-segment__btn")[1]); // wizard
    const eyeBtns = container.querySelectorAll('[aria-label="Reveal API key"]');
    expect(eyeBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("reveals API key in wizard field when eye toggle clicked", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_wiz_full" keyPrefix="mnfst_wi" />
    ));
    const fullSegment = container.querySelector(".setup-segment--full");
    fireEvent.click(fullSegment!.querySelectorAll(".setup-segment__btn")[1]); // wizard
    expect(container.textContent).not.toContain("mnfst_wiz_full");
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_wiz_full");
  });

  it("disables wizard API Key copy when key is hidden", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_wiz" keyPrefix="mnfst_wi" />
    ));
    const fullSegment = container.querySelector(".setup-segment--full");
    fireEvent.click(fullSegment!.querySelectorAll(".setup-segment__btn")[1]); // wizard
    const disabledCopies = container.querySelectorAll('[aria-label="Copy disabled"]');
    expect(disabledCopies.length).toBeGreaterThanOrEqual(1);
  });

  it("switches to Toolkits tab on click", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const segmentBtns = container.querySelectorAll(".setup-segment__btn");
    fireEvent.click(segmentBtns[1]); // Toolkits
    expect(container.querySelector(".framework-snippets")).not.toBeNull();
    expect(container.querySelector(".setup-agents-card")).toBeNull();
  });

  it("shows toolkit tabs on Toolkits tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    fireEvent.click(container.querySelectorAll(".setup-segment__btn")[1]);
    const tabs = container.querySelectorAll(".panel__tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0].textContent).toContain("OpenAI SDK");
  });

  it("shows full API key on Toolkits tab when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_test_key" />
    ));
    fireEvent.click(container.querySelectorAll(".setup-segment__btn")[1]);
    expect(container.textContent).toContain("mnfst_test_key");
  });

  it("shows placeholder when no apiKey or keyPrefix", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("mnfst_YOUR_KEY");
  });

  it("has copy buttons", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const copyButtons = container.querySelectorAll(".modal-terminal__copy");
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Model field on Toolkits tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    fireEvent.click(container.querySelectorAll(".setup-segment__btn")[1]);
    const fields = container.querySelectorAll(".framework-snippets__field");
    expect(fields.length).toBe(3);
    expect(fields[2].textContent).toContain("Model");
    expect(fields[2].textContent).toContain("auto");
  });

  it("switches between tabs correctly", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const segmentBtns = container.querySelectorAll(".setup-segment__btn");
    expect(container.querySelector(".setup-agents-card")).not.toBeNull();
    fireEvent.click(segmentBtns[1]); // Toolkits
    expect(container.querySelector(".framework-snippets")).not.toBeNull();
    expect(container.querySelector(".setup-agents-card")).toBeNull();
    fireEvent.click(segmentBtns[0]); // Agents
    expect(container.querySelector(".setup-agents-card")).not.toBeNull();
    expect(container.querySelector(".framework-snippets")).toBeNull();
  });

  it("uses setup-step__heading class", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".setup-step__heading")).not.toBeNull();
  });

  it("includes api key in CLI snippet", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_test" keyPrefix="mnfst_tes" />
    ));
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_test");
  });
});
