import {
  supportsSubscriptionProvider,
  getSubscriptionProviderConfig,
  getSubscriptionKnownModels,
  getSubscriptionCapabilities,
} from "manifest-shared";

describe("subscription capability manifests", () => {
  it("publishes MiniMax device-code metadata", () => {
    expect(supportsSubscriptionProvider("minimax")).toBe(true);
    expect(getSubscriptionProviderConfig("minimax")).toMatchObject({
      supportsSubscription: true,
      subscriptionLabel: "MiniMax Coding Plan",
      subscriptionAuthMode: "device_code",
    });
    expect(getSubscriptionKnownModels("minimax")).toContain("MiniMax-M2.5");
    expect(getSubscriptionCapabilities("minimax")).toMatchObject({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    });
  });

  it("keeps existing auth-mode metadata for Anthropic and OpenAI", () => {
    expect(getSubscriptionProviderConfig("anthropic")).toMatchObject({
      subscriptionAuthMode: "token",
    });
    expect(getSubscriptionProviderConfig("openai")).toMatchObject({
      subscriptionAuthMode: "popup_oauth",
      subscriptionOAuth: true,
    });
  });
});
