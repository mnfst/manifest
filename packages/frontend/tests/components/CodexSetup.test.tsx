import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

import CodexSetup from "../../src/components/CodexSetup";

const writeText = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal("navigator", {
  clipboard: { writeText },
});

describe("CodexSetup", () => {
  beforeEach(() => {
    writeText.mockClear();
  });

  it("renders a paste-ready ~/.codex/config.toml block with a masked prefix when the full key is unavailable", async () => {
    const { container } = render(() => (
      <CodexSetup
        apiKey={null}
        keyPrefix="mnfst_live"
        baseUrl="http://localhost:38240/v1"
      />
    ));

    expect(container.textContent).toContain("~/.codex/config.toml");
    expect(container.textContent).toContain("OPENAI_API_KEY");
    expect(container.textContent).toContain('base_url = "http://localhost:38240/v1"');
    expect(container.textContent).toContain('wire_api = "responses"');
    expect(container.textContent).toContain('export OPENAI_API_KEY="mnfst_live..."');
    // No reveal toggle when there's no full key to unmask.
    expect(screen.queryByLabelText("Reveal API key")).toBeNull();

    const copyConfig = container.querySelector(
      '.setup-cli-block__actions [aria-label="Copy to clipboard"]',
    );
    expect(copyConfig).not.toBeNull();
    fireEvent.click(copyConfig!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('export OPENAI_API_KEY="mnfst_live..."'),
      );
    });
  });

  it("falls back to the mnfst_YOUR_KEY placeholder when both apiKey and keyPrefix are missing", () => {
    const { container } = render(() => (
      <CodexSetup apiKey={null} keyPrefix={null} baseUrl="http://localhost:38240/v1" />
    ));

    expect(container.textContent).toContain('export OPENAI_API_KEY="mnfst_YOUR_KEY"');
    expect(container.textContent).not.toContain("...");
    expect(screen.queryByLabelText("Reveal API key")).toBeNull();
  });

  it("reveals and hides the full API key without changing the copy payload", async () => {
    const { container } = render(() => (
      <CodexSetup
        apiKey="mnfst_secret"
        keyPrefix="mnfst_live"
        baseUrl="http://localhost:38240/v1"
      />
    ));

    expect(container.textContent).toContain('export OPENAI_API_KEY="mnfst_live..."');
    expect(container.textContent).not.toContain("mnfst_secret");

    fireEvent.click(screen.getByLabelText("Reveal API key"));
    expect(container.textContent).toContain('export OPENAI_API_KEY="mnfst_secret"');

    fireEvent.click(screen.getByLabelText("Hide API key"));
    expect(container.textContent).toContain('export OPENAI_API_KEY="mnfst_live..."');

    const copyFullConfig = container.querySelector(
      '.setup-cli-block__actions [aria-label="Copy to clipboard"]',
    );
    expect(copyFullConfig).not.toBeNull();
    fireEvent.click(copyFullConfig!);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('export OPENAI_API_KEY="mnfst_secret"'),
      );
    });
  });
});
