import { describe, it, expect, vi, beforeEach } from "vitest";

let signalValue: unknown[] = [];
const mockSetToasts = vi.fn((fn: (prev: unknown[]) => unknown[]) => {
  signalValue = fn(signalValue);
});

vi.mock("solid-js", () => ({
  createSignal: (init: unknown[]) => {
    signalValue = init;
    return [() => signalValue, mockSetToasts];
  },
}));

describe("toast-store", () => {
  beforeEach(async () => {
    vi.resetModules();
    signalValue = [];
    mockSetToasts.mockClear();
  });

  it("addToast creates a toast with default duration", async () => {
    const { addToast, toasts } = await import("../../src/services/toast-store.js");

    addToast("error", "Something went wrong");

    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toMatchObject({
      type: "error",
      message: "Something went wrong",
      duration: 6000,
    });
  });

  it("addToast uses custom duration when provided", async () => {
    const { addToast, toasts } = await import("../../src/services/toast-store.js");

    addToast("success", "Done", 2000);

    expect(toasts()[0].duration).toBe(2000);
  });

  it("addToast returns unique ids", async () => {
    const { addToast } = await import("../../src/services/toast-store.js");

    const id1 = addToast("error", "Error 1");
    const id2 = addToast("warning", "Warning 1");

    expect(id1).not.toBe(id2);
  });

  it("dismissToast removes a toast by id", async () => {
    const { addToast, dismissToast, toasts } = await import("../../src/services/toast-store.js");

    const id = addToast("success", "Done");
    addToast("error", "Fail");
    dismissToast(id);

    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].type).toBe("error");
  });

  it("toast.error creates an error toast", async () => {
    const { toast, toasts } = await import("../../src/services/toast-store.js");

    toast.error("Oops");

    expect(toasts()[0]).toMatchObject({ type: "error", message: "Oops" });
  });

  it("toast.success creates a success toast with 4s duration", async () => {
    const { toast, toasts } = await import("../../src/services/toast-store.js");

    toast.success("Saved");

    expect(toasts()[0]).toMatchObject({
      type: "success",
      message: "Saved",
      duration: 4000,
    });
  });

  it("toast.warning creates a warning toast with 5s duration", async () => {
    const { toast, toasts } = await import("../../src/services/toast-store.js");

    toast.warning("Careful");

    expect(toasts()[0]).toMatchObject({
      type: "warning",
      message: "Careful",
      duration: 5000,
    });
  });
});
