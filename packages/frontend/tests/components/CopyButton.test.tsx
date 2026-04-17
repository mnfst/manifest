import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const writeTextMock = vi.fn().mockResolvedValue(undefined);
vi.stubGlobal("navigator", {
  clipboard: { writeText: writeTextMock },
});

import CopyButton from "../../src/components/CopyButton";

describe("CopyButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    writeTextMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a button with Copy title", () => {
    const { container } = render(() => <CopyButton text="hello" />);
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("title")).toBe("Copy");
  });

  it("has aria-label 'Copy to clipboard' initially", () => {
    render(() => <CopyButton text="hello" />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toBe("Copy to clipboard");
  });

  it("renders copy icon SVG with rect element initially", () => {
    const { container } = render(() => <CopyButton text="hello" />);
    expect(container.querySelector("svg rect")).not.toBeNull();
    expect(container.querySelector("svg polyline")).toBeNull();
  });

  it("calls navigator.clipboard.writeText with the text prop on click", async () => {
    render(() => <CopyButton text="test-text-123" />);
    const btn = screen.getByRole("button");
    await fireEvent.click(btn);
    expect(writeTextMock).toHaveBeenCalledWith("test-text-123");
  });

  it("changes aria-label to 'Copied' after successful copy", async () => {
    render(() => <CopyButton text="hello" />);
    const btn = screen.getByRole("button");
    await fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toBe("Copied");
  });

  it("shows check icon SVG after successful copy", async () => {
    const { container } = render(() => <CopyButton text="hello" />);
    await fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector("svg polyline")).not.toBeNull();
    expect(container.querySelector("svg rect")).toBeNull();
  });

  it("reverts aria-label to 'Copy to clipboard' after 2000ms timeout", async () => {
    render(() => <CopyButton text="hello" />);
    const btn = screen.getByRole("button");
    await fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toBe("Copied");
    vi.advanceTimersByTime(2000);
    expect(btn.getAttribute("aria-label")).toBe("Copy to clipboard");
  });

  it("reverts to copy icon after 2000ms timeout", async () => {
    const { container } = render(() => <CopyButton text="hello" />);
    await fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector("svg polyline")).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(container.querySelector("svg rect")).not.toBeNull();
    expect(container.querySelector("svg polyline")).toBeNull();
  });

  it("shows 'Copy failed' aria-label on clipboard failure", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("clipboard denied"));
    render(() => <CopyButton text="hello" />);
    const btn = screen.getByRole("button");
    await fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toBe("Copy failed");
  });

  it("reverts 'Copy failed' back to 'Copy to clipboard' after 2000ms", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("clipboard denied"));
    render(() => <CopyButton text="hello" />);
    const btn = screen.getByRole("button");
    await fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toBe("Copy failed");
    vi.advanceTimersByTime(2000);
    expect(btn.getAttribute("aria-label")).toBe("Copy to clipboard");
  });

  it("has modal-terminal__copy class", () => {
    const { container } = render(() => <CopyButton text="hello" />);
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });

  it("renders disabled when disabled prop is true", () => {
    const { container } = render(() => <CopyButton text="hello" disabled />);
    const btn = container.querySelector("button")!;
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("aria-label")).toBe("Copy disabled");
    expect(btn.getAttribute("title")).toBe("Reveal key first");
  });

  it("does not copy when disabled and clicked", async () => {
    render(() => <CopyButton text="hello" disabled />);
    const btn = screen.getByRole("button");
    await fireEvent.click(btn);
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("has disabled class when disabled", () => {
    const { container } = render(() => <CopyButton text="hello" disabled />);
    expect(container.querySelector(".modal-terminal__copy--disabled")).not.toBeNull();
  });

  it("does not have disabled class when not disabled", () => {
    const { container } = render(() => <CopyButton text="hello" />);
    expect(container.querySelector(".modal-terminal__copy--disabled")).toBeNull();
  });
});
