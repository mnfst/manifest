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

  it("handles clipboard failure gracefully without changing state", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("clipboard denied"));
    render(() => <CopyButton text="hello" />);
    const btn = screen.getByRole("button");
    await fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toBe("Copy to clipboard");
  });

  it("has modal-terminal__copy class", () => {
    const { container } = render(() => <CopyButton text="hello" />);
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });
});
