import { existsSync, readFileSync } from "fs";
import { loadJsonFile } from "../src/json-file";

jest.mock("fs");

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe("loadJsonFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an empty object when the file does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    expect(loadJsonFile("/tmp/missing.json")).toEqual({});
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("parses JSON when the file exists", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"ok":true}');

    expect(loadJsonFile("/tmp/config.json")).toEqual({ ok: true });
  });

  it("warns and returns an empty object for array JSON", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('["a","b"]');

    expect(loadJsonFile("/tmp/array.json")).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      "[manifest] Invalid JSON object in /tmp/array.json; expected a top-level object",
    );

    warnSpy.mockRestore();
  });

  it("warns and returns an empty object for null JSON", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("null");

    expect(loadJsonFile("/tmp/null.json")).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      "[manifest] Invalid JSON object in /tmp/null.json; expected a top-level object",
    );

    warnSpy.mockRestore();
  });

  it("warns and returns an empty object for primitive JSON", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("42");

    expect(loadJsonFile("/tmp/number.json")).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      "[manifest] Invalid JSON object in /tmp/number.json; expected a top-level object",
    );

    warnSpy.mockRestore();
  });

  it("warns and returns an empty object for malformed JSON", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not valid json");

    expect(loadJsonFile("/tmp/bad.json")).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[manifest] Failed to read JSON file /tmp/bad.json:"),
    );

    warnSpy.mockRestore();
  });

  it("warns and returns an empty object for non-Error failures", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw "permission denied";
    });

    expect(loadJsonFile("/tmp/forbidden.json")).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      "[manifest] Failed to read JSON file /tmp/forbidden.json: permission denied",
    );

    warnSpy.mockRestore();
  });
});
