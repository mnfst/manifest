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

import Help from "../../src/pages/Help";

describe("Help", () => {
  it("shows Help & Support heading", () => {
    render(() => <Help />);
    expect(screen.getByText("Help & Support")).toBeDefined();
  });

  it("shows Schedule a Call section", () => {
    render(() => <Help />);
    expect(screen.getByText("Schedule a Call")).toBeDefined();
  });

  it("shows Email Support section", () => {
    render(() => <Help />);
    expect(screen.getByText("Email Support")).toBeDefined();
  });

  it("has Book link", () => {
    render(() => <Help />);
    const links = screen.getAllByRole("link");
    const bookLink = links.find((l) => l.textContent?.includes("Book"));
    expect(bookLink).toBeDefined();
  });

  it("has Contact link", () => {
    render(() => <Help />);
    const links = screen.getAllByRole("link");
    const contactLink = links.find((l) => l.textContent?.includes("Contact"));
    expect(contactLink).toBeDefined();
  });
});
