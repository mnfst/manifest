import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import ApiKeyDisplay from "../../src/components/ApiKeyDisplay";

describe("ApiKeyDisplay", () => {
  it("renders nothing when apiKey and keyPrefix are both null", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey={null} keyPrefix={null} />
    ));
    expect(container.textContent).toBe("");
  });

  it("shows warning message when apiKey is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey="mnfst_full_key_123" keyPrefix={null} />
    ));
    expect(container.textContent).toContain(
      "Save your API key. You won't see it again after closing this dialog."
    );
  });

  it("shows the full API key value when apiKey is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey="mnfst_full_key_123" keyPrefix={null} />
    ));
    expect(container.textContent).toContain("mnfst_full_key_123");
  });

  it("renders CopyButton alongside the API key", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey="mnfst_full_key_123" keyPrefix={null} />
    ));
    const copyBtn = container.querySelector(".modal-terminal__copy");
    expect(copyBtn).not.toBeNull();
  });

  it("shows prefix hint when only keyPrefix is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey={null} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("Replace");
    expect(container.textContent).toContain("mnfst_abc...");
    expect(container.textContent).toContain("below with your full API key.");
  });

  it("does not show prefix hint when full key is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey="mnfst_full_key" keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).not.toContain("Replace");
    expect(container.textContent).not.toContain("below with your full API key.");
  });

  it("does not show warning when only keyPrefix is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey={null} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).not.toContain(
      "Save your API key -- you won't see it again"
    );
  });

  it("renders api-key-display__warning class when apiKey is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey="mnfst_key" keyPrefix={null} />
    ));
    expect(container.querySelector(".api-key-display__warning")).not.toBeNull();
  });

  it("renders api-key-display__value class when apiKey is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey="mnfst_key" keyPrefix={null} />
    ));
    expect(container.querySelector(".api-key-display__value")).not.toBeNull();
  });

  it("renders api-key-display__prefix class when only keyPrefix is provided", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey={null} keyPrefix="mnfst_pre" />
    ));
    expect(container.querySelector(".api-key-display__prefix")).not.toBeNull();
  });

  it("renders prefix inside a code element", () => {
    const { container } = render(() => (
      <ApiKeyDisplay apiKey={null} keyPrefix="mnfst_pre" />
    ));
    const code = container.querySelector("code.api-key-display__code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe("mnfst_pre...");
  });
});
