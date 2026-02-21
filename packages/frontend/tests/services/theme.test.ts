import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCssVar, getHsl, getHslA } from "../../src/services/theme.js";

describe("theme utilities", () => {
  beforeEach(() => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: vi.fn((name: string) => {
        if (name === "--primary") return " 210 40% 98% ";
        if (name === "--accent") return " 0 0% 100% ";
        return "";
      }),
    } as unknown as CSSStyleDeclaration);
  });

  describe("getCssVar", () => {
    it("returns trimmed CSS variable value", () => {
      expect(getCssVar("--primary")).toBe("210 40% 98%");
    });

    it("returns empty string for unknown variable", () => {
      expect(getCssVar("--unknown")).toBe("");
    });
  });

  describe("getHsl", () => {
    it("wraps value in hsl()", () => {
      expect(getHsl("--primary")).toBe("hsl(210 40% 98%)");
    });
  });

  describe("getHslA", () => {
    it("wraps value in hsl() with alpha", () => {
      expect(getHslA("--primary", 0.5)).toBe("hsl(210 40% 98% / 0.5)");
    });

    it("handles alpha of 1", () => {
      expect(getHslA("--accent", 1)).toBe("hsl(0 0% 100% / 1)");
    });
  });
});
