import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import ErrorState from "../../src/components/ErrorState";

describe("ErrorState", () => {
  it("renders default title", () => {
    render(() => <ErrorState />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders custom title", () => {
    render(() => <ErrorState title="Custom Error" />);
    expect(screen.getByText("Custom Error")).toBeDefined();
  });

  it("extracts message from Error object", () => {
    render(() => <ErrorState error={new Error("Network failure")} />);
    expect(screen.getByText("Network failure")).toBeDefined();
  });

  it("extracts message from string error", () => {
    render(() => <ErrorState error="Something broke" />);
    expect(screen.getByText("Something broke")).toBeDefined();
  });

  it("uses override message over error object", () => {
    render(() => <ErrorState error={new Error("original")} message="Override msg" />);
    expect(screen.getByText("Override msg")).toBeDefined();
  });

  it("shows default message for non-error objects", () => {
    render(() => <ErrorState error={42} />);
    expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeDefined();
  });

  it("shows retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(() => <ErrorState onRetry={onRetry} />);
    const btn = screen.getByText("Try again");
    expect(btn).toBeDefined();
  });

  it("calls onRetry when retry button clicked", async () => {
    const onRetry = vi.fn();
    render(() => <ErrorState onRetry={onRetry} />);
    const btn = screen.getByText("Try again");
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalled();
  });

  it("hides retry button when no onRetry", () => {
    render(() => <ErrorState />);
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("has role=alert for accessibility", () => {
    render(() => <ErrorState />);
    expect(screen.getByRole("alert")).toBeDefined();
  });
});
