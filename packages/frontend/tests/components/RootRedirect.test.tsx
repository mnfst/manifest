import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  Navigate: (props: Record<string, unknown>) => (
    <div data-testid="navigate" data-href={props.href as string} />
  ),
}));

import RootRedirect from "../../src/components/RootRedirect";

describe("RootRedirect", () => {
  it("redirects the root path to the global Overview", () => {
    const { container } = render(() => <RootRedirect />);
    const navigate = container.querySelector('[data-testid="navigate"]');
    expect(navigate).not.toBeNull();
    expect(navigate?.getAttribute("data-href")).toBe("/overview");
  });
});
