import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockSignInSocial = vi.fn();

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    signIn: { social: (...args: any[]) => mockSignInSocial(...args) },
  },
}));

import SocialButtons from "../../src/components/SocialButtons";

describe("SocialButtons", () => {
  beforeEach(() => {
    mockSignInSocial.mockClear();
  });

  it("renders all 3 social buttons when no enabledProviders prop", () => {
    render(() => <SocialButtons />);
    expect(screen.getByText("Continue with Google")).toBeDefined();
    expect(screen.getByText("Continue with GitHub")).toBeDefined();
    expect(screen.getByText("Continue with Discord")).toBeDefined();
  });

  it("renders only enabled providers", () => {
    render(() => <SocialButtons enabledProviders={["google"]} />);
    expect(screen.getByText("Continue with Google")).toBeDefined();
    expect(screen.queryByText("Continue with GitHub")).toBeNull();
    expect(screen.queryByText("Continue with Discord")).toBeNull();
  });

  it("renders nothing when enabledProviders is empty", () => {
    const { container } = render(() => <SocialButtons enabledProviders={[]} />);
    expect(container.querySelector(".auth-social-group")).toBeNull();
  });

  it("calls signIn.social on Google click", async () => {
    render(() => <SocialButtons />);
    await fireEvent.click(screen.getByText("Continue with Google"));
    expect(mockSignInSocial).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }));
  });

  it("calls signIn.social on GitHub click", async () => {
    render(() => <SocialButtons />);
    await fireEvent.click(screen.getByText("Continue with GitHub"));
    expect(mockSignInSocial).toHaveBeenCalledWith(expect.objectContaining({ provider: "github" }));
  });

  it("calls signIn.social on Discord click", async () => {
    render(() => <SocialButtons />);
    await fireEvent.click(screen.getByText("Continue with Discord"));
    expect(mockSignInSocial).toHaveBeenCalledWith(expect.objectContaining({ provider: "discord" }));
  });
});
