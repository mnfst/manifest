import { describe, it, expect, beforeEach } from "vitest";

// We need to reset the module for each test to clear state
describe("toast-store", () => {
  let addToast: typeof import("../../src/services/toast-store").addToast;
  let dismissToast: typeof import("../../src/services/toast-store").dismissToast;
  let toasts: typeof import("../../src/services/toast-store").toasts;
  let toast: typeof import("../../src/services/toast-store").toast;

  beforeEach(async () => {
    const mod = await import("../../src/services/toast-store");
    addToast = mod.addToast;
    dismissToast = mod.dismissToast;
    toasts = mod.toasts;
    toast = mod.toast;
    // Clear existing toasts
    for (const t of toasts()) {
      dismissToast(t.id);
    }
  });

  it("adds a toast with default duration", () => {
    const id = addToast("error", "Something went wrong");
    const list = toasts();
    expect(list.length).toBeGreaterThanOrEqual(1);
    const found = list.find((t) => t.id === id);
    expect(found).toBeDefined();
    expect(found!.type).toBe("error");
    expect(found!.message).toBe("Something went wrong");
    expect(found!.duration).toBe(6000);
  });

  it("adds toast with custom duration", () => {
    const id = addToast("success", "Saved!", 2000);
    const found = toasts().find((t) => t.id === id);
    expect(found!.duration).toBe(2000);
  });

  it("dismisses a toast by id", () => {
    const id = addToast("warning", "Watch out");
    expect(toasts().some((t) => t.id === id)).toBe(true);
    dismissToast(id);
    expect(toasts().some((t) => t.id === id)).toBe(false);
  });

  it("toast.error creates error toast", () => {
    const id = toast.error("Err");
    const found = toasts().find((t) => t.id === id);
    expect(found!.type).toBe("error");
  });

  it("toast.success creates success toast", () => {
    const id = toast.success("OK");
    const found = toasts().find((t) => t.id === id);
    expect(found!.type).toBe("success");
    expect(found!.duration).toBe(4000);
  });

  it("toast.warning creates warning toast", () => {
    const id = toast.warning("Warn");
    const found = toasts().find((t) => t.id === id);
    expect(found!.type).toBe("warning");
    expect(found!.duration).toBe(5000);
  });
});
