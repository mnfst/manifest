import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

import ActionMenu from "../../src/components/ActionMenu";

describe("ActionMenu", () => {
  it("renders only the trigger when closed", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    expect(container.querySelector(".action-menu__trigger")).not.toBeNull();
    expect(container.querySelector(".action-menu__dropdown")).toBeNull();
  });

  it("opens the dropdown and lists the items on trigger click", () => {
    const { container } = render(() => (
      <ActionMenu items={[{ label: "Edit", onClick: () => {} }, { label: "Remove", danger: true, onClick: () => {} }]} />
    ));
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    const items = container.querySelectorAll(".action-menu__item");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe("Edit");
    expect(items[1].classList.contains("action-menu__item--danger")).toBe(true);
  });

  it("toggles closed when the trigger is clicked again", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    const trigger = container.querySelector(".action-menu__trigger")!;
    fireEvent.click(trigger);
    expect(container.querySelector(".action-menu__dropdown")).not.toBeNull();
    fireEvent.click(trigger);
    expect(container.querySelector(".action-menu__dropdown")).toBeNull();
  });

  it("invokes the item callback and closes the dropdown", () => {
    const onClick = vi.fn();
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick }]} />);
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    fireEvent.click(container.querySelector(".action-menu__item")!);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".action-menu__dropdown")).toBeNull();
  });

  it("closes when clicking outside the menu", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    expect(container.querySelector(".action-menu__dropdown")).not.toBeNull();
    fireEvent.click(document.body);
    expect(container.querySelector(".action-menu__dropdown")).toBeNull();
  });

  it("stays open when clicking inside the menu container", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    // A click that bubbles to the document but originates inside the container
    // must not close the menu.
    fireEvent.click(container.querySelector(".action-menu__dropdown")!);
    expect(container.querySelector(".action-menu__dropdown")).not.toBeNull();
  });

  it("closes when Escape is pressed", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    expect(container.querySelector(".action-menu__dropdown")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".action-menu__dropdown")).toBeNull();
  });

  it("ignores non-Escape keydowns while open", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(container.querySelector(".action-menu__dropdown")).not.toBeNull();
  });

  it("uses the default trigger aria-label", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    expect(container.querySelector(".action-menu__trigger")!.getAttribute("aria-label")).toBe("Actions");
  });

  it("applies a custom aria-label and root class", () => {
    const { container } = render(() => (
      <ActionMenu class="agent-card__menu" ariaLabel="Actions for foo" items={[{ label: "Edit", onClick: () => {} }]} />
    ));
    expect(container.querySelector(".action-menu")!.classList.contains("agent-card__menu")).toBe(true);
    expect(container.querySelector(".action-menu__trigger")!.getAttribute("aria-label")).toBe("Actions for foo");
  });

  it("reflects the open state with the --open modifier", () => {
    const { container } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    const root = container.querySelector(".action-menu")!;
    expect(root.classList.contains("action-menu--open")).toBe(false);
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    expect(root.classList.contains("action-menu--open")).toBe(true);
  });

  it("renders a leading icon when provided", () => {
    const { container } = render(() => (
      <ActionMenu items={[{ label: "Edit", icon: <svg data-testid="icon" />, onClick: () => {} }]} />
    ));
    fireEvent.click(container.querySelector(".action-menu__trigger")!);
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull();
  });

  it("removes the document listeners on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(() => <ActionMenu items={[{ label: "Edit", onClick: () => {} }]} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("click", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
