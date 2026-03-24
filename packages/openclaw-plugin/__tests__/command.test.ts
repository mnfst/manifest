import { registerCommand } from "../src/command";
import { verifyConnection } from "../src/verify";
import { ManifestConfig } from "../src/config";

jest.mock("../src/verify", () => ({
  verifyConnection: jest.fn(),
}));
const mockVerify = verifyConnection as jest.MockedFunction<typeof verifyConnection>;

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const config: ManifestConfig = {
  mode: "cloud",
  devMode: true,
  apiKey: "",
  endpoint: "http://localhost:38238/otlp",
  port: 2099,
  host: "127.0.0.1",
};

describe("registerCommand", () => {
  it("registers /manifest command when registerCommand is available", () => {
    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    expect(api.registerCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "manifest",
        description: expect.any(String),
        handler: expect.any(Function),
        execute: expect.any(Function),
      }),
    );
  });

  it("skips gracefully when registerCommand is not available", () => {
    const api = {};
    registerCommand(api, config, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("not available"),
    );
  });

  it("handler returns status text on successful verify", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: true,
      authValid: true,
      agentName: "test-agent",
      error: null,
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.handler();

    expect(result).toContain("Mode: cloud");
    expect(result).toContain("Endpoint reachable: yes");
    expect(result).toContain("Auth valid: yes");
    expect(result).toContain("Agent: test-agent");
    expect(result).not.toContain("Error:");
  });

  it("includes error in status text when verify reports one", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: false,
      authValid: false,
      agentName: null,
      error: "Cannot reach endpoint: ECONNREFUSED",
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.handler();

    expect(result).toContain("Endpoint reachable: no");
    expect(result).toContain("Error: Cannot reach endpoint: ECONNREFUSED");
  });

  it("execute returns { text, content } on successful verify", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: true,
      authValid: true,
      agentName: "test-agent",
      error: null,
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result.text).toContain("Mode: cloud");
    expect(result.text).toContain("Agent: test-agent");
    expect(result.content).toEqual([
      { type: "text", text: expect.stringContaining("Mode: cloud") },
    ]);
  });

  it("execute wraps error status in both text and content", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: false,
      authValid: false,
      agentName: null,
      error: "Cannot reach endpoint: ECONNREFUSED",
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result.text).toContain("Endpoint reachable: no");
    expect(result.content[0].text).toContain("Error: Cannot reach endpoint: ECONNREFUSED");
  });

  it("handler returns error message when verify throws", async () => {
    mockVerify.mockRejectedValueOnce(new Error("network down"));

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.handler();

    expect(result).toContain("Manifest status check failed: network down");
  });

  it("execute wraps thrown error in text and content", async () => {
    mockVerify.mockRejectedValueOnce(new Error("network down"));

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result.text).toBe("Manifest status check failed: network down");
    expect(result.content).toEqual([
      { type: "text", text: "Manifest status check failed: network down" },
    ]);
  });

  it("handler returns stringified error when verify throws a non-Error value", async () => {
    mockVerify.mockRejectedValueOnce("string-error");

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.handler();

    expect(result).toContain("Manifest status check failed: string-error");
  });

  it("omits agent line when agentName is null", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: true,
      authValid: true,
      agentName: null,
      error: null,
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.handler();

    expect(result).toContain("Mode: cloud");
    expect(result).toContain("Endpoint reachable: yes");
    expect(result).not.toContain("Agent:");
  });

  it("logs debug message after registering the command", () => {
    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Registered /manifest command",
    );
  });
});
