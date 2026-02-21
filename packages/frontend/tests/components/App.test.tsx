import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("../../src/components/Header.jsx", () => ({
  default: () => <div data-testid="header">Header</div>,
}));

vi.mock("../../src/components/Sidebar.jsx", () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock("../../src/components/AuthGuard.jsx", () => ({
  default: (props: any) => <div data-testid="auth-guard">{props.children}</div>,
}));

vi.mock("../../src/services/sse.js", () => ({
  connectSse: () => () => {},
}));

import App from "../../src/App";

describe("App", () => {
  it("renders the app shell", () => {
    const { container } = render(() => <App />);
    expect(container.querySelector(".app-shell")).not.toBeNull();
  });

  it("renders AuthGuard wrapper", () => {
    const { container } = render(() => <App />);
    expect(container.querySelector('[data-testid="auth-guard"]')).not.toBeNull();
  });

  it("renders Header", () => {
    const { container } = render(() => <App />);
    expect(container.querySelector('[data-testid="header"]')).not.toBeNull();
  });

  it("renders main content area", () => {
    const { container } = render(() => <App />);
    expect(container.querySelector(".main-content")).not.toBeNull();
  });

  it("does not show sidebar on non-agent paths", () => {
    const { container } = render(() => <App />);
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
  });
});

describe("App structure", () => {
  it("renders app-body container", () => {
    const { container } = render(() => <App />);
    expect(container.querySelector(".app-body")).not.toBeNull();
  });

  it("has aria-label on main content", () => {
    const { container } = render(() => <App />);
    const main = container.querySelector('main[aria-label="Dashboard content"]');
    expect(main).not.toBeNull();
  });
});
