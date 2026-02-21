import { describe, it, expect, vi, beforeEach } from "vitest";

describe("theme", () => {
  beforeEach(() => {
    // Mock document.documentElement with getComputedStyle
    vi.stubGlobal("document", {
      documentElement: {},
    });
    vi.stubGlobal("getComputedStyle", vi.fn(() => ({
      getPropertyValue: vi.fn((name: string) => {
        if (name === "--primary") return " 220 80% 50% ";
        if (name === "--bg") return " 0 0% 100% ";
        return "";
      }),
    })));
  });

  it("getCssVar reads and trims CSS variable", async () => {
    const { getCssVar } = await import("../../src/services/theme");
    expect(getCssVar("--primary")).toBe("220 80% 50%");
  });

  it("getHsl wraps value in hsl()", async () => {
    const { getHsl } = await import("../../src/services/theme");
    expect(getHsl("--primary")).toBe("hsl(220 80% 50%)");
  });

  it("getHslA wraps with alpha", async () => {
    const { getHslA } = await import("../../src/services/theme");
    expect(getHslA("--primary", 0.5)).toBe("hsl(220 80% 50% / 0.5)");
  });

  it("handles empty CSS variable", async () => {
    const { getCssVar } = await import("../../src/services/theme");
    expect(getCssVar("--nonexistent")).toBe("");
  });
});
