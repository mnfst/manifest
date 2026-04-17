import { describe, it, expect } from "vitest";
import { highlight } from "../../src/services/syntax-highlight";

describe("highlight", () => {
  it("highlights Python code with span tags", () => {
    const result = highlight('from openai import OpenAI', "python");
    expect(result).toContain("<span");
    expect(result).toContain("hljs-keyword");
    expect(result).toContain("import");
  });

  it("highlights TypeScript code with span tags", () => {
    const result = highlight('const x: string = "hello";', "typescript");
    expect(result).toContain("<span");
    expect(result).toContain("hljs-keyword");
  });

  it("highlights bash code with span tags", () => {
    const result = highlight('export FOO="bar"', "bash");
    expect(result).toContain("<span");
  });

  it("escapes HTML for unknown languages", () => {
    const result = highlight('<script>alert("xss")</script>', "unknown_lang_xyz");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("preserves code content in output", () => {
    const code = 'client = OpenAI(base_url="http://localhost")';
    const result = highlight(code, "python");
    // Verify the highlighted HTML still contains the original tokens
    expect(result).toContain("client");
    expect(result).toContain("OpenAI");
    expect(result).toContain("http://localhost");
  });

  it("returns string output", () => {
    const result = highlight("echo hello", "bash");
    expect(typeof result).toBe("string");
  });

  it("handles empty code", () => {
    const result = highlight("", "python");
    expect(result).toBe("");
  });

  it("escapes ampersands for unknown languages", () => {
    const result = highlight("a & b", "nonexistent_lang");
    expect(result).toContain("&amp;");
  });

  it("escapes angle brackets for unknown languages", () => {
    const result = highlight("a > b < c", "nonexistent_lang");
    expect(result).toContain("&gt;");
    expect(result).toContain("&lt;");
  });
});
