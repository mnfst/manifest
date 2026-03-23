describe("subscription capability manifests", () => {
  const pluginCapabilities = require("../subscription-capabilities");
  const sharedCapabilities = require("../../subscription-capabilities");

  it("publishes MiniMax device-code metadata in both manifests", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.supportsSubscriptionProvider("minimax")).toBe(true);
      expect(capabilities.getSubscriptionProviderConfig("minimax")).toMatchObject({
        supportsSubscription: true,
        subscriptionLabel: "MiniMax Coding Plan",
        subscriptionAuthMode: "device_code",
      });
      expect(capabilities.getSubscriptionKnownModels("minimax")).toContain("MiniMax-M2.5");
      expect(capabilities.getSubscriptionCapabilities("minimax")).toMatchObject({
        maxContextWindow: 200000,
        supportsPromptCaching: false,
        supportsBatching: false,
      });
    }
  });

  it("publishes Ollama Cloud token metadata in both manifests", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.supportsSubscriptionProvider("ollama-cloud")).toBe(true);
      expect(capabilities.getSubscriptionProviderConfig("ollama-cloud")).toMatchObject({
        supportsSubscription: true,
        subscriptionLabel: "Ollama Cloud Plan",
        subscriptionAuthMode: "token",
      });
      expect(capabilities.getSubscriptionKnownModels("ollama-cloud")).toContain("glm-5");
      expect(capabilities.getSubscriptionCapabilities("ollama-cloud")).toMatchObject({
        maxContextWindow: 128000,
      });
    }
  });

  it("publishes OpenCode Go token metadata in both manifests", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.supportsSubscriptionProvider("opencode-go")).toBe(true);
      expect(capabilities.getSubscriptionProviderConfig("opencode-go")).toMatchObject({
        supportsSubscription: true,
        subscriptionLabel: "OpenCode Go Plan",
        subscriptionAuthMode: "token",
      });
      expect(capabilities.getSubscriptionKnownModels("opencode-go")).toEqual([
        "glm-5",
        "kimi-k2.5",
        "minimax-m2.5",
      ]);
      expect(capabilities.getSubscriptionCapabilities("opencode-go")).toMatchObject({
        maxContextWindow: 128000,
        supportsPromptCaching: false,
        supportsBatching: false,
      });
    }
  });

  it("publishes Z.ai token metadata in both manifests", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.supportsSubscriptionProvider("zai")).toBe(true);
      expect(capabilities.getSubscriptionProviderConfig("zai")).toMatchObject({
        supportsSubscription: true,
        subscriptionLabel: "Z.ai Coding Plan",
        subscriptionAuthMode: "token",
      });
      expect(capabilities.getSubscriptionKnownModels("zai")).toContain("glm-5");
      expect(capabilities.getSubscriptionCapabilities("zai")).toMatchObject({
        maxContextWindow: 128000,
        supportsPromptCaching: false,
        supportsBatching: false,
      });
    }
  });

  it("publishes NanoGPT token metadata in both manifests", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.supportsSubscriptionProvider("nano-gpt")).toBe(true);
      expect(capabilities.getSubscriptionProviderConfig("nano-gpt")).toMatchObject({
        supportsSubscription: true,
        subscriptionLabel: "NanoGPT subscription",
        subscriptionAuthMode: "token",
        subscriptionKeyPlaceholder: "Paste your API key",
      });
      expect(capabilities.getSubscriptionCapabilities("nano-gpt")).toMatchObject({
        maxContextWindow: 200000,
        supportsPromptCaching: false,
        supportsBatching: false,
      });
    }
  });

  it("publishes Kimi Code token metadata in both manifests", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.supportsSubscriptionProvider("kimi")).toBe(true);
      expect(capabilities.getSubscriptionProviderConfig("kimi")).toMatchObject({
        supportsSubscription: true,
        subscriptionLabel: "Kimi Code subscription",
        subscriptionAuthMode: "token",
        subscriptionKeyPlaceholder: "Paste your API key",
      });
      expect(capabilities.getSubscriptionKnownModels("kimi")).toEqual(["kimi-for-coding"]);
      expect(capabilities.getSubscriptionCapabilities("kimi")).toMatchObject({
        maxContextWindow: 262144,
        supportsPromptCaching: false,
        supportsBatching: false,
      });
    }
  });

  it("exposes catalog helpers for overlapping provider ids", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.getSubscriptionKnownModelMatchMode("OPENCODE-GO")).toBe("exact");
      expect(capabilities.getSubscriptionKnownModelMatchMode("zai")).toBe("prefix");

      expect(capabilities.getSubscriptionCatalogMode("opencode-go")).toBe("known_only");
      expect(capabilities.getSubscriptionCatalogMode("zai")).toBe("full");

      expect(capabilities.shouldQualifySubscriptionModelIds("nano-gpt")).toBe(true);
      expect(capabilities.shouldQualifySubscriptionModelIds("ollama-cloud")).toBe(true);
      expect(capabilities.shouldQualifySubscriptionModelIds("zai")).toBe(true);
      expect(capabilities.shouldQualifySubscriptionModelIds("anthropic")).toBe(false);
    }
  });

  it("keeps existing auth-mode metadata for Anthropic and OpenAI", () => {
    for (const capabilities of [pluginCapabilities, sharedCapabilities]) {
      expect(capabilities.getSubscriptionProviderConfig("anthropic")).toMatchObject({
        subscriptionAuthMode: "token",
      });
      expect(capabilities.getSubscriptionProviderConfig("openai")).toMatchObject({
        subscriptionAuthMode: "popup_oauth",
        subscriptionOAuth: true,
      });
    }
  });
});
