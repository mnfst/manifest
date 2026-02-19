const inquire = require("../stubs/inquire");

describe("inquire stub", () => {
  it("exports a function", () => {
    expect(typeof inquire).toBe("function");
  });

  it("returns null when called with no arguments", () => {
    expect(inquire()).toBeNull();
  });

  it("returns null when called with a module name", () => {
    expect(inquire("child_process")).toBeNull();
  });

  it("returns null for any argument", () => {
    expect(inquire("fs")).toBeNull();
    expect(inquire("path")).toBeNull();
    expect(inquire(42)).toBeNull();
    expect(inquire(undefined)).toBeNull();
  });
});
