import { describe, it, expect } from "vitest";
import { CURRENT_NEWS } from "../../src/services/news";

describe("CURRENT_NEWS", () => {
  it("is either null or a well-formed news item", () => {
    if (CURRENT_NEWS === null) {
      expect(CURRENT_NEWS).toBeNull();
      return;
    }
    expect(CURRENT_NEWS.id).toBeTruthy();
    expect(CURRENT_NEWS.title).toBeTruthy();
    expect(CURRENT_NEWS.blurb).toBeTruthy();
    // Thumbnail must be self-hosted (CSP forbids external images).
    expect(CURRENT_NEWS.thumbnail.startsWith("/")).toBe(true);
    // Link must be absolute (opens in a new tab).
    expect(CURRENT_NEWS.href).toMatch(/^https?:\/\//);
    expect(CURRENT_NEWS.cta).toBeTruthy();
  });
});
