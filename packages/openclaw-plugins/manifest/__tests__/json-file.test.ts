jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { existsSync, readFileSync } from "fs";
import { loadJsonFile } from "../src/json-file";

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

beforeEach(() => jest.clearAllMocks());

describe("loadJsonFile", () => {
  it("returns empty object when file does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    expect(loadJsonFile("/tmp/missing.json")).toEqual({});
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("parses and returns valid JSON content", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"key":"value","count":42}');

    const result = loadJsonFile("/tmp/valid.json");

    expect(result).toEqual({ key: "value", count: 42 });
    expect(mockReadFileSync).toHaveBeenCalledWith("/tmp/valid.json", "utf-8");
  });

  it("returns empty object when file contains invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not valid json {{{");

    expect(loadJsonFile("/tmp/invalid.json")).toEqual({});
  });

  it("returns empty object when readFileSync throws", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    expect(loadJsonFile("/tmp/unreadable.json")).toEqual({});
  });
});
