import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  A: (props: Record<string, unknown>) => {
    const { href, class: className, children, ...rest } = props;
    return <a href={href as string} class={className as string} {...rest}>{children}</a>;
  },
}));

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
});
