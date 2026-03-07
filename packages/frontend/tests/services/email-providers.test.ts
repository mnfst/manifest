import { describe, expect, it } from "vitest";
import { EMAIL_PROVIDER_OPTIONS } from "../../src/services/email-providers";

describe("EMAIL_PROVIDER_OPTIONS", () => {
  it("requires an API key URL for every email provider option", () => {
    const missingProviderIds = EMAIL_PROVIDER_OPTIONS.filter(
      (provider) => provider.apiKeyUrl.trim().length === 0,
    ).map((provider) => provider.id);
    expect(missingProviderIds).toEqual([]);
  });
});
