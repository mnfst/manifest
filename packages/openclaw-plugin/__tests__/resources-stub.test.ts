const { Resource } = require("../stubs/resources");

describe("Resource stub", () => {
  describe("constructor", () => {
    it("stores attributes from the constructor argument", () => {
      const r = new Resource({ "service.name": "test" });
      expect(r.attributes).toEqual({ "service.name": "test" });
    });

    it("defaults to empty attributes when none provided", () => {
      const r = new Resource();
      expect(r.attributes).toEqual({});
    });

    it("resolves async attributes and merges them", async () => {
      const asyncAttrs = Promise.resolve({ "async.key": "value" });
      const r = new Resource({ "sync.key": "initial" }, asyncAttrs);

      expect(r.asyncAttributesPending).toBe(true);

      await r.waitForAsyncAttributes();

      expect(r.asyncAttributesPending).toBe(false);
      expect(r.attributes).toEqual({
        "sync.key": "initial",
        "async.key": "value",
      });
    });

    it("handles async attributes rejection gracefully", async () => {
      const asyncAttrs = Promise.reject(new Error("detector failed"));
      const r = new Resource({ "sync.key": "initial" }, asyncAttrs);

      expect(r.asyncAttributesPending).toBe(true);

      await r.waitForAsyncAttributes();

      expect(r.asyncAttributesPending).toBe(false);
      // Attributes should remain unchanged after rejection
      expect(r.attributes).toEqual({ "sync.key": "initial" });
    });
  });

  describe("waitForAsyncAttributes", () => {
    it("resolves immediately when no async attributes", async () => {
      const r = new Resource({ key: "val" });
      const result = await r.waitForAsyncAttributes();
      expect(result).toBeUndefined();
    });
  });

  describe("merge", () => {
    it("returns self when merging with null/undefined", () => {
      const r = new Resource({ a: 1 });
      expect(r.merge(null)).toBe(r);
      expect(r.merge(undefined)).toBe(r);
    });

    it("merges attributes from another Resource", () => {
      const r1 = new Resource({ a: 1 });
      const r2 = new Resource({ b: 2 });
      const merged = r1.merge(r2);
      expect(merged.attributes).toEqual({ a: 1, b: 2 });
    });

    it("other resource attributes override self on conflict", () => {
      const r1 = new Resource({ key: "original" });
      const r2 = new Resource({ key: "override" });
      const merged = r1.merge(r2);
      expect(merged.attributes).toEqual({ key: "override" });
    });
  });

  describe("static methods", () => {
    it("EMPTY has no attributes", () => {
      expect(Resource.EMPTY.attributes).toEqual({});
    });

    it("empty() returns EMPTY singleton", () => {
      expect(Resource.empty()).toBe(Resource.EMPTY);
    });

    it("default() returns a Resource with sdk language", () => {
      const r = Resource.default();
      expect(r.attributes).toEqual({ "telemetry.sdk.language": "nodejs" });
    });
  });
});
