import { describe, it, expect, afterEach, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import VersionIndicator from "../../src/components/VersionIndicator";

describe("VersionIndicator", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nothing when not self-hosted", () => {
    vi.stubEnv("VITE_MANIFEST_SELFHOSTED", "");
    const { container } = render(() => <VersionIndicator />);
    expect(container.querySelector(".version-indicator")).toBeNull();
  });

  it("renders nothing when the flag is anything other than 'true'", () => {
    vi.stubEnv("VITE_MANIFEST_SELFHOSTED", "false");
    const { container } = render(() => <VersionIndicator />);
    expect(container.querySelector(".version-indicator")).toBeNull();
  });

  it("renders v{version} when self-hosted", () => {
    vi.stubEnv("VITE_MANIFEST_SELFHOSTED", "true");
    const { container } = render(() => <VersionIndicator />);
    const badge = container.querySelector(".version-indicator");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe(`v${__MANIFEST_VERSION__}`);
    expect(badge?.getAttribute("aria-label")).toBe(
      `Version ${__MANIFEST_VERSION__}`,
    );
  });
});
