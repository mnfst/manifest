import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import RoutingInstructionModal from "../../src/components/RoutingInstructionModal";

describe("RoutingInstructionModal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={false} mode="enable" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("shows 'Activate routing' title in enable mode", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(screen.getByText("Activate routing")).toBeDefined();
  });

  it("shows manifest/auto command in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("manifest/auto");
  });

  it("shows 'Deactivate routing' title in disable mode", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="disable" onClose={() => {}} />
    ));
    expect(screen.getByText("Deactivate routing")).toBeDefined();
  });

  it("shows <your-model> placeholder in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("<your-model>");
  });

  it("shows restart command in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("shows restart command in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("calls onClose when Done is clicked", () => {
    const onClose = vi.fn();
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={onClose} />
    ));
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has a copy button", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });

  it("shows terminal UI", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal")).not.toBeNull();
  });
});
