import { runApiKeyAuth, buildModelConfig } from "../src/auth";
import { API_KEY_PREFIX, DEFAULTS } from "../src/constants";
import type { ProviderAuthContext, WizardPrompter } from "../src/types";

function createMockPrompter(): WizardPrompter & {
  capturedTextParams: Parameters<WizardPrompter["text"]>[0] | null;
} {
  const prompter = {
    capturedTextParams: null as Parameters<WizardPrompter["text"]>[0] | null,
    intro: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    outro: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    note: jest.fn<Promise<void>, [string, string?]>().mockResolvedValue(undefined),
    select: jest.fn().mockResolvedValue(undefined),
    text: jest.fn<Promise<string>, [Parameters<WizardPrompter["text"]>[0]]>().mockImplementation(
      (params) => {
        prompter.capturedTextParams = params;
        return Promise.resolve("mnfst_test_key_123");
      },
    ),
    confirm: jest.fn().mockResolvedValue(false),
    progress: jest.fn().mockReturnValue({ update: jest.fn(), stop: jest.fn() }),
  };
  return prompter;
}

function createMockContext(prompter: WizardPrompter): ProviderAuthContext {
  return {
    config: {},
    prompter,
    runtime: {},
    isRemote: false,
    openUrl: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("runApiKeyAuth", () => {
  it("calls intro with Manifest in the title", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    await runApiKeyAuth(ctx);

    expect(prompter.intro).toHaveBeenCalledTimes(1);
    expect(prompter.intro).toHaveBeenCalledWith(
      expect.stringContaining("Manifest"),
    );
  });

  it("calls note with setup info and title", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    await runApiKeyAuth(ctx);

    expect(prompter.note).toHaveBeenCalledTimes(1);
    expect(prompter.note).toHaveBeenCalledWith(
      expect.stringContaining("manifest.build"),
      expect.stringContaining("About Manifest"),
    );
  });

  it("calls text to prompt for API key", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    await runApiKeyAuth(ctx);

    expect(prompter.text).toHaveBeenCalledTimes(1);
    expect(prompter.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("API key"),
        placeholder: expect.stringContaining(API_KEY_PREFIX),
      }),
    );
  });

  it("calls outro after successful auth", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    await runApiKeyAuth(ctx);

    expect(prompter.outro).toHaveBeenCalledTimes(1);
    expect(prompter.outro).toHaveBeenCalledWith(
      expect.stringContaining("Manifest configured"),
    );
  });

  it("returns profiles with profileId manifest:default", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    const result = await runApiKeyAuth(ctx);

    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].profileId).toBe("manifest:default");
  });

  it("returns credential with type api_key and provider manifest", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    const result = await runApiKeyAuth(ctx);

    expect(result.profiles[0].credential).toEqual(
      expect.objectContaining({
        type: "api_key",
        provider: "manifest",
      }),
    );
  });

  it("returns the trimmed key in the credential", async () => {
    const prompter = createMockPrompter();
    (prompter.text as jest.Mock).mockResolvedValue("  mnfst_padded_key  ");
    const ctx = createMockContext(prompter);

    const result = await runApiKeyAuth(ctx);

    expect(result.profiles[0].credential.key).toBe("mnfst_padded_key");
  });

  it("returns configPatch with models.providers.manifest", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    const result = await runApiKeyAuth(ctx);

    const patch = result.configPatch as Record<string, unknown>;
    const models = patch.models as Record<string, unknown>;
    const providers = models.providers as Record<string, unknown>;
    const manifest = providers.manifest as Record<string, unknown>;

    expect(manifest.baseUrl).toBe(`${DEFAULTS.ENDPOINT}/v1`);
    expect(manifest.api).toBe("openai-completions");
    expect(manifest.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "auto", name: "Auto Router" }),
      ]),
    );
  });

  it("returns defaultModel manifest/auto", async () => {
    const prompter = createMockPrompter();
    const ctx = createMockContext(prompter);

    const result = await runApiKeyAuth(ctx);

    expect(result.defaultModel).toBe("manifest/auto");
  });

  describe("validate callback", () => {
    let validate: (v: string) => string | undefined;

    beforeEach(async () => {
      const prompter = createMockPrompter();
      const ctx = createMockContext(prompter);
      await runApiKeyAuth(ctx);
      validate = prompter.capturedTextParams!.validate!;
    });

    it("rejects empty string", () => {
      expect(validate("")).toBe("API key is required");
    });

    it("rejects whitespace-only string", () => {
      expect(validate("   ")).toBe("API key is required");
    });

    it("rejects key without mnfst_ prefix", () => {
      const result = validate("invalid_key_123");
      expect(result).toContain(API_KEY_PREFIX);
    });

    it("rejects key with old osk_ prefix", () => {
      const result = validate("osk_old_key");
      expect(result).toContain(API_KEY_PREFIX);
    });

    it("accepts valid key starting with mnfst_", () => {
      expect(validate("mnfst_valid_key")).toBeUndefined();
    });
  });
});

describe("buildModelConfig", () => {
  it("returns baseUrl with /v1 appended", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.baseUrl).toBe("https://example.com/v1");
  });

  it("returns api as openai-completions", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.api).toBe("openai-completions");
  });

  it("returns a single model with id auto", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.models).toHaveLength(1);
    expect(result.models[0].id).toBe("auto");
  });

  it("returns model with name Auto Router", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.models[0].name).toBe("Auto Router");
  });

  it("returns model with contextWindow 200000", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.models[0].contextWindow).toBe(200000);
  });

  it("returns model with maxTokens 16384", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.models[0].maxTokens).toBe(16384);
  });

  it("returns model with reasoning false", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.models[0].reasoning).toBe(false);
  });

  it("returns model with text input", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.models[0].input).toEqual(["text"]);
  });

  it("returns model with zero costs", () => {
    const result = buildModelConfig("https://example.com");
    expect(result.models[0].cost).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });
});
