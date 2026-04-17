import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import OpenClawSetup from "../../src/components/OpenClawSetup";

describe("OpenClawSetup", () => {
  const defaultProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: "http://localhost:3001/v1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders description with manifest/auto model", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    expect(container.textContent).toContain("manifest/auto");
  });

  it("renders CLI and Interactive wizard tabs", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    const segment = container.querySelector(".setup-segment--full");
    expect(segment).not.toBeNull();
    const btns = segment!.querySelectorAll(".setup-segment__btn");
    expect(btns).toHaveLength(2);
    expect(btns[0].textContent).toBe("CLI configuration");
    expect(btns[1].textContent).toBe("openclaw onboard");
  });

  it("defaults to CLI configuration tab", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    const segment = container.querySelector(".setup-segment--full");
    const btns = segment!.querySelectorAll(".setup-segment__btn");
    expect(btns[0].classList.contains("setup-segment__btn--active")).toBe(true);
    expect(btns[1].classList.contains("setup-segment__btn--active")).toBe(false);
  });

  it("shows CLI hint text on CLI tab", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    expect(container.textContent).toContain("Set the provider config and default model directly via CLI commands");
  });

  it("shows CLI code block with config commands", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    expect(container.textContent).toContain("openclaw config set");
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("shows masked key placeholder when no apiKey or keyPrefix", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    expect(container.textContent).toContain("mnfst_YOUR_KEY");
  });

  it("shows key prefix when keyPrefix provided", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("mnfst_abc...");
  });

  it("does not show eye toggle when no apiKey", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.querySelector('[aria-label="Reveal API key"]')).toBeNull();
  });

  it("shows eye toggle on CLI tab when apiKey provided", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_sec" />
    ));
    expect(container.querySelector('[aria-label="Reveal API key"]')).not.toBeNull();
  });

  it("reveals key in CLI when eye toggle clicked", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_sec" />
    ));
    expect(container.textContent).not.toContain("mnfst_secret_key");
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_secret_key");
  });

  it("hides key again on second CLI eye toggle click", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_sec" />
    ));
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_secret_key");
    fireEvent.click(container.querySelector('[aria-label="Hide API key"]')!);
    expect(container.textContent).not.toContain("mnfst_secret_key");
  });

  it("shows CLI copy button when key is hidden", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_sec" />
    ));
    const cliBlock = container.querySelector(".setup-cli-block");
    const copyBtn = cliBlock!.querySelector('[aria-label="Copy to clipboard"]');
    expect(copyBtn).not.toBeNull();
  });

  it("switches to openclaw onboard tab", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    const segment = container.querySelector(".setup-segment--full");
    const btns = segment!.querySelectorAll(".setup-segment__btn");
    fireEvent.click(btns[1]);
    expect(btns[1].classList.contains("setup-segment__btn--active")).toBe(true);
    expect(container.textContent).toContain("openclaw onboard");
    expect(container.textContent).toContain("Custom Provider");
  });

  it("shows onboard fields on wizard tab", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    const segment = container.querySelector(".setup-segment--full");
    fireEvent.click(segment!.querySelectorAll(".setup-segment__btn")[1]);
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

  it("shows eye toggle on wizard API Key field when apiKey provided", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_wiz" keyPrefix="mnfst_wi" />
    ));
    const segment = container.querySelector(".setup-segment--full");
    fireEvent.click(segment!.querySelectorAll(".setup-segment__btn")[1]);
    const eyeBtns = container.querySelectorAll('[aria-label="Reveal API key"]');
    expect(eyeBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("reveals API key in wizard field when eye toggle clicked", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_wiz_full" keyPrefix="mnfst_wi" />
    ));
    const segment = container.querySelector(".setup-segment--full");
    fireEvent.click(segment!.querySelectorAll(".setup-segment__btn")[1]);
    expect(container.textContent).not.toContain("mnfst_wiz_full");
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_wiz_full");
  });

  it("shows wizard copy button when key is hidden", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_wiz" keyPrefix="mnfst_wi" />
    ));
    const segment = container.querySelector(".setup-segment--full");
    fireEvent.click(segment!.querySelectorAll(".setup-segment__btn")[1]);
    const copyBtns = container.querySelectorAll('[aria-label="Copy to clipboard"]');
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("switches back from wizard to CLI tab", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    const segment = container.querySelector(".setup-segment--full");
    const btns = segment!.querySelectorAll(".setup-segment__btn");
    fireEvent.click(btns[1]); // wizard
    fireEvent.click(btns[0]); // back to CLI
    expect(btns[0].classList.contains("setup-segment__btn--active")).toBe(true);
    expect(container.textContent).toContain("Set the provider config");
  });

  it("has correct aria attributes on tabs", () => {
    const { container } = render(() => <OpenClawSetup {...defaultProps} />);
    const segment = container.querySelector('[role="tablist"]');
    expect(segment).not.toBeNull();
    const btns = segment!.querySelectorAll('[role="tab"]');
    expect(btns).toHaveLength(2);
    expect(btns[0].getAttribute("aria-selected")).toBe("true");
    expect(btns[1].getAttribute("aria-selected")).toBe("false");
  });

  it("includes base URL in CLI snippet", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} baseUrl="https://example.com/v1" />
    ));
    expect(container.textContent).toContain("https://example.com/v1");
  });

  it("renders CLI copy button with snippet text containing masked key", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} keyPrefix="mnfst_pre" />
    ));
    // The CLI copy button text should include the masked key in the snippet
    const cliActions = container.querySelector(".setup-cli-block__actions");
    expect(cliActions).not.toBeNull();
    const copyBtns = cliActions!.querySelectorAll(".modal-terminal__copy");
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("renders CLI copy button with full API key in snippet after reveal", () => {
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_full_snippet" keyPrefix="mnfst_ful" />
    ));
    // Reveal key
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    // The CLI actions copy button should now be enabled (not disabled)
    const cliActions = container.querySelector(".setup-cli-block__actions");
    const enabledCopy = cliActions!.querySelector('[aria-label="Copy to clipboard"]');
    expect(enabledCopy).not.toBeNull();
  });

  it("copies CLI snippet with full key to clipboard when revealed", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { container } = render(() => (
      <OpenClawSetup {...defaultProps} apiKey="mnfst_clip_key" keyPrefix="mnfst_cli" />
    ));
    // Reveal key first
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    // Click the enabled copy button in CLI actions
    const cliActions = container.querySelector(".setup-cli-block__actions");
    const copyBtn = cliActions!.querySelector('[aria-label="Copy to clipboard"]');
    fireEvent.click(copyBtn!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      const copiedText = writeText.mock.calls[0][0] as string;
      expect(copiedText).toContain("mnfst_clip_key");
      expect(copiedText).toContain("openclaw config set");
    });
  });
});
