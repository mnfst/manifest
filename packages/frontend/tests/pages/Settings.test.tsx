import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/agents/test-agent/settings", state: null }),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockGetAgentKey = vi.fn();
const mockDeleteAgent = vi.fn();
const mockRotateAgentKey = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getAgentKey: (...args: unknown[]) => mockGetAgentKey(...args),
  deleteAgent: (...args: unknown[]) => mockDeleteAgent(...args),
  rotateAgentKey: (...args: unknown[]) => mockRotateAgentKey(...args),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", pluginEndpoint: null });
    mockDeleteAgent.mockResolvedValue(undefined);
    mockRotateAgentKey.mockResolvedValue({ apiKey: "new-key" });
  });

  it("renders Settings heading", () => {
    render(() => <Settings />);
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders General tab", () => {
    render(() => <Settings />);
    expect(screen.getByText("General")).toBeDefined();
  });

  it("renders agent name input with value", () => {
    render(() => <Settings />);
    const input = screen.getByLabelText("Agent name") as HTMLInputElement;
    expect(input.value).toBe("test-agent");
  });

  it("renders Integration tab", () => {
    render(() => <Settings />);
    expect(screen.getByText("Integration")).toBeDefined();
  });

  it("does not render LLM Providers tab", () => {
    render(() => <Settings />);
    expect(screen.queryByText("LLM Providers")).toBeNull();
  });

  it("renders only two tab buttons", () => {
    render(() => <Settings />);
    expect(screen.getByText("General")).toBeDefined();
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

  it("shows key prefix after loading", async () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Integration"));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("mnfst_abc");
    });
  });

  it("opens delete modal on Delete agent click", () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Delete agent"));
    expect(container.textContent).toContain("Delete test-agent");
  });

  it("has rotate key button", async () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Integration"));
    await vi.waitFor(() => {
      const rotateBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Rotate key"),
      );
      expect(rotateBtn).not.toBeUndefined();
    });
  });

  it("save button is disabled when agent name unchanged", () => {
    const { container } = render(() => <Settings />);
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Save"),
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("save button enables when agent name changes", () => {
    const { container } = render(() => <Settings />);
    const input = screen.getByLabelText("Agent name") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new-name" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Save"),
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it("clicking Save navigates when name changed", async () => {
    const { container } = render(() => <Settings />);
    const input = screen.getByLabelText("Agent name") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "new-name" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Save"),
    ) as HTMLButtonElement;
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Saved");
    });
  });

  it("clicking Rotate key calls rotateAgentKey", async () => {
    mockRotateAgentKey.mockResolvedValue({ apiKey: "mnfst_new_rotated_key" });
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Integration"));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Rotate key");
    });
    const rotateBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Rotate key"),
    )!;
    fireEvent.click(rotateBtn);
    await vi.waitFor(() => {
      expect(mockRotateAgentKey).toHaveBeenCalledWith("test-agent");
    });
  });

  it("shows rotated key after successful rotation", async () => {
    mockRotateAgentKey.mockResolvedValue({ apiKey: "mnfst_new_rotated_key" });
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Integration"));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Rotate key");
    });
    const rotateBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Rotate key"),
    )!;
    fireEvent.click(rotateBtn);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("mnfst_new_rotated_key");
      expect(container.textContent).toContain("won't be shown again");
    });
  });

  it("delete button is disabled until name matches", () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Delete agent"));
    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Delete this agent"),
    ) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  it("delete button enables when name matches", () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Delete agent"));
    const confirmInput = container.querySelector('.modal-overlay input[type="text"]') as HTMLInputElement;
    fireEvent.input(confirmInput, { target: { value: "test-agent" } });
    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Delete this agent"),
    ) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(false);
  });

  it("calls deleteAgent when confirmed", async () => {
    mockDeleteAgent.mockResolvedValue(undefined);
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Delete agent"));
    const confirmInput = container.querySelector('.modal-overlay input[type="text"]') as HTMLInputElement;
    fireEvent.input(confirmInput, { target: { value: "test-agent" } });
    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Delete this agent"),
    )!;
    fireEvent.click(deleteBtn);
    await vi.waitFor(() => {
      expect(mockDeleteAgent).toHaveBeenCalledWith("test-agent");
    });
  });

  it("closes delete modal when close button clicked", () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Delete agent"));
    expect(container.querySelector(".modal-overlay")).not.toBeNull();
    const closeBtn = container.querySelector('.modal-overlay [aria-label="Close"]')!;
    fireEvent.click(closeBtn);
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("shows OTLP ingest key label", () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Integration"));
    expect(container.textContent).toContain("OTLP ingest key");
  });

  it("shows setup steps after loading", async () => {
    const { container } = render(() => <Settings />);
    fireEvent.click(screen.getByText("Integration"));
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="setup-install"]')).not.toBeNull();
    });
  });

  it("shows breadcrumb with agent name", () => {
    const { container } = render(() => <Settings />);
    expect(container.textContent).toContain("test-agent");
    expect(container.textContent).toContain("Configure your agent");
  });
});
