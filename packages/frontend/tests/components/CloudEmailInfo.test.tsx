import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import CloudEmailInfo from "../../src/components/CloudEmailInfo";

describe("CloudEmailInfo", () => {
  it("renders the title", () => {
    render(() => <CloudEmailInfo email="test@example.com" />);
    expect(screen.getByText("Email alerts")).toBeDefined();
  });

  it("displays the user email", () => {
    const { container } = render(() => <CloudEmailInfo email="user@manifest.build" />);
    expect(container.textContent).toContain("user@manifest.build");
  });

  it("renders the mail icon", () => {
    const { container } = render(() => <CloudEmailInfo email="test@example.com" />);
    const icon = container.querySelector(".cloud-email-info__icon");
    expect(icon).not.toBeNull();
  });

  it("renders the description text", () => {
    const { container } = render(() => <CloudEmailInfo email="test@example.com" />);
    expect(container.textContent).toContain("Alerts will be sent to");
  });
});
