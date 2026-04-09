import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import CodeBlock from "../../src/components/CodeBlock";

describe("CodeBlock", () => {
  it("renders code content", () => {
    const { container } = render(() => (
      <CodeBlock code='print("hello")' language="python" />
    ));
    expect(container.textContent).toContain('print("hello")');
  });

  it("applies syntax highlighting", () => {
    const { container } = render(() => (
      <CodeBlock code="from openai import OpenAI" language="python" />
    ));
    const codeEl = container.querySelector("code");
    expect(codeEl).not.toBeNull();
    expect(codeEl!.innerHTML).toContain("<span");
    expect(codeEl!.innerHTML).toContain("hljs-keyword");
  });

  it("adds language class to code element", () => {
    const { container } = render(() => (
      <CodeBlock code="const x = 1;" language="typescript" />
    ));
    const codeEl = container.querySelector("code");
    expect(codeEl!.classList.contains("language-typescript")).toBe(true);
    expect(codeEl!.classList.contains("hljs")).toBe(true);
  });

  it("renders a copy button", () => {
    const { container } = render(() => (
      <CodeBlock code="echo hello" language="bash" />
    ));
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });

  it("uses setup-method__code wrapper class", () => {
    const { container } = render(() => (
      <CodeBlock code="echo hello" language="bash" />
    ));
    expect(container.querySelector(".setup-method__code")).not.toBeNull();
  });

  it("uses copyText for copy button when provided", () => {
    const { container } = render(() => (
      <CodeBlock code="masked_key" language="python" copyText="real_secret_key" />
    ));
    const copyBtn = container.querySelector(".modal-terminal__copy");
    expect(copyBtn).not.toBeNull();
    // The displayed code should be the masked version
    expect(container.textContent).toContain("masked_key");
  });

  it("renders pre element with proper styling", () => {
    const { container } = render(() => (
      <CodeBlock code="test" language="bash" />
    ));
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
  });

  it("handles bash/shell syntax", () => {
    const { container } = render(() => (
      <CodeBlock code='curl -X POST http://localhost -H "Content-Type: application/json"' language="bash" />
    ));
    expect(container.textContent).toContain("curl");
    expect(container.textContent).toContain("Content-Type");
  });

  it("handles unknown language gracefully", () => {
    const { container } = render(() => (
      <CodeBlock code="some code" language="unknown_lang_xyz" />
    ));
    expect(container.textContent).toContain("some code");
  });
});
