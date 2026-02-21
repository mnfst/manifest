import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import ToastContainer from "../../src/components/ToastContainer";
import { addToast, dismissToast, toasts } from "../../src/services/toast-store";

describe("ToastContainer", () => {
  // Clear all toasts before each test
  function clearToasts() {
    for (const t of toasts()) {
      dismissToast(t.id);
    }
  }

  it("renders empty when no toasts", () => {
    clearToasts();
    const { container } = render(() => <ToastContainer />);
    expect(container.querySelectorAll(".toast").length).toBe(0);
  });

  it("renders a toast message", () => {
    clearToasts();
    addToast("error", "Something went wrong");
    render(() => <ToastContainer />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders multiple toasts", () => {
    clearToasts();
    addToast("success", "Saved!");
    addToast("warning", "Watch out");
    const { container } = render(() => <ToastContainer />);
    expect(container.querySelectorAll(".toast").length).toBe(2);
  });

  it("applies correct class based on toast type", () => {
    clearToasts();
    addToast("error", "Error toast");
    const { container } = render(() => <ToastContainer />);
    expect(container.querySelector(".toast--error")).toBeDefined();
  });

  it("has dismiss button", () => {
    clearToasts();
    addToast("success", "Done");
    render(() => <ToastContainer />);
    expect(screen.getByLabelText("Dismiss notification")).toBeDefined();
  });

  it("has role=alert for accessibility", () => {
    clearToasts();
    addToast("error", "Alert");
    render(() => <ToastContainer />);
    expect(screen.getByRole("alert")).toBeDefined();
  });
});
