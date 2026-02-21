import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/agents/test-agent/settings", state: null }),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/api.js", () => ({
  getAgentKey: vi.fn().mockResolvedValue({ keyPrefix: "mnfst_abc", pluginEndpoint: null }),
  deleteAgent: vi.fn().mockResolvedValue(undefined),
  rotateAgentKey: vi.fn().mockResolvedValue({ apiKey: "new-key" }),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/SetupStepInstall.jsx", () => ({
  default: () => <div data-testid="setup-install" />,
  CopyButton: () => <button>Copy</button>,
}));

vi.mock("../../src/components/SetupStepConfigure.jsx", () => ({
  default: () => <div data-testid="setup-configure" />,
}));

vi.mock("../../src/components/SetupStepVerify.jsx", () => ({
  default: () => <div data-testid="setup-verify" />,
}));

import Settings from "../../src/pages/Settings";

describe("Settings", () => {
  it("renders Settings heading", () => {
    render(() => <Settings />);
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders General section", () => {
    render(() => <Settings />);
    expect(screen.getByText("General")).toBeDefined();
  });

  it("renders agent name input", () => {
    render(() => <Settings />);
    expect(screen.getByLabelText("Agent name")).toBeDefined();
  });

  it("renders API Key section", () => {
    render(() => <Settings />);
    expect(screen.getByText("API Key")).toBeDefined();
  });

  it("renders Danger zone", () => {
    render(() => <Settings />);
    expect(screen.getByText("Danger zone")).toBeDefined();
  });

  it("renders Delete agent button", () => {
    render(() => <Settings />);
    expect(screen.getByText("Delete agent")).toBeDefined();
  });
});
