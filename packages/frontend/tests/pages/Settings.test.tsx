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
  getProviders: vi.fn().mockResolvedValue([]),
  connectProvider: vi.fn().mockResolvedValue(undefined),
  disconnectProvider: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/services/routing.js", () => ({
  agentPath: (name: string, sub: string) => `/agents/${name}${sub}`,
  useAgentName: () => () => "test-agent",
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

  it("renders Integration tab", () => {
    render(() => <Settings />);
    expect(screen.getByText("Integration")).toBeDefined();
  });

  it("renders Danger zone", () => {
    render(() => <Settings />);
    expect(screen.getByText("Danger zone")).toBeDefined();
  });

  it("renders Delete agent button", () => {
    render(() => <Settings />);
    expect(screen.getByText("Delete agent")).toBeDefined();
  });

  it("renders LLM Providers tab", () => {
    render(() => <Settings />);
    expect(screen.getByText("LLM Providers")).toBeDefined();
  });

  it("renders all three tab buttons", () => {
    render(() => <Settings />);
    expect(screen.getByText("General")).toBeDefined();
    expect(screen.getByText("LLM Providers")).toBeDefined();
    expect(screen.getByText("Integration")).toBeDefined();
  });

  it("renders breadcrumb with agent name", () => {
    render(() => <Settings />);
    const matches = screen.getAllByText(/test-agent/);
    expect(matches.length).toBeGreaterThan(0);
    const breadcrumb = matches.find(el => el.classList.contains("breadcrumb"));
    expect(breadcrumb).toBeDefined();
  });

  it("renders Save button disabled when name unchanged", () => {
    render(() => <Settings />);
    const saveSpan = screen.getByText("Save");
    expect(saveSpan).toBeDefined();
    const saveButton = saveSpan.closest("button") as HTMLButtonElement;
    expect(saveButton).toBeDefined();
    expect(saveButton.disabled).toBe(true);
  });
});
