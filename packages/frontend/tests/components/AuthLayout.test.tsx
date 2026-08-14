import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";

import AuthLayout from "../../src/layouts/AuthLayout";

describe("AuthLayout", () => {
  it("renders children", () => {
    render(() => (
      <AuthLayout>
        <span>Test child content</span>
      </AuthLayout>
    ));
    expect(screen.getByText("Test child content")).toBeDefined();
  });

  it("renders logo images", () => {
    const { container } = render(() => (
      <AuthLayout>
        <span>Content</span>
      </AuthLayout>
    ));
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(2);
  });

  it("links logo to manifest website", () => {
    const { container } = render(() => (
      <AuthLayout>
        <span>Content</span>
      </AuthLayout>
    ));
    const link = container.querySelector(".auth-logo__link") as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("https://manifest.build");
  });
});
