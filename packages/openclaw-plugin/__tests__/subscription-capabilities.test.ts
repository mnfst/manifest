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
