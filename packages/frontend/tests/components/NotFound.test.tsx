import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  A: (props: Record<string, unknown>) => {
    const { href, class: className, children, ...rest } = props;
    return <a href={href as string} class={className as string} {...rest}>{children}</a>;
  },
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: Record<string, unknown>) => <title>{props.children}</title>,
  Meta: () => null,
}));

import NotFound from "../../src/pages/NotFound";

describe("NotFound", () => {
  it("shows 404 code", () => {
    render(() => <NotFound />);
    expect(screen.getByText("404")).toBeDefined();
  });

  it("shows page not found heading", () => {
    render(() => <NotFound />);
    expect(screen.getByText("Page not found")).toBeDefined();
  });

  it("shows description text", () => {
    render(() => <NotFound />);
    expect(screen.getByText(/doesn't exist or has been moved/)).toBeDefined();
  });

  it("has a link back to dashboard", () => {
    render(() => <NotFound />);
    expect(screen.getByText("Back to dashboard")).toBeDefined();
  });
});
