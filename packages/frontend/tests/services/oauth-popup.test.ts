import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { monitorOAuthPopup } from "../../src/services/oauth-popup.js";

describe("monitorOAuthPopup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cleans up after bcTimeout fires without resolution", () => {
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");

    const popup = {
      closed: true,
      close: vi.fn(),
      get location(): Location {
        throw new DOMException("cross-origin");
      },
    } as unknown as Window;

    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    monitorOAuthPopup(popup, { onSuccess, onFailure });

    // Advance past one polling interval so popup.closed is detected
    vi.advanceTimersByTime(300);

    // Now advance past the 30-second BroadcastChannel timeout
    vi.advanceTimersByTime(30_000);

    // fullCleanup should have been called — removeEventListener is evidence
    expect(removeListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));

    // Neither callback was called (the popup just closed without a result)
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();

    removeListenerSpy.mockRestore();
  });

  it("does not run bcTimeout cleanup if handled before timeout fires", () => {
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");

    const popup = {
      closed: true,
      close: vi.fn(),
      get location(): Location {
        throw new DOMException("cross-origin");
      },
    } as unknown as Window;

    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    monitorOAuthPopup(popup, { onSuccess, onFailure });

    // Advance past one polling interval so popup.closed is detected
    vi.advanceTimersByTime(300);

    // Simulate postMessage arriving before the 5-minute timeout
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "manifest-oauth-success" } })
    );

    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Clear the spy call count to check if bcTimeout triggers cleanup again
    removeListenerSpy.mockClear();

    // Advance past the 30-second timeout -- cleanup should NOT run again
    vi.advanceTimersByTime(30_000);

    // removeEventListener should not be called again (handled flag prevents it)
    expect(removeListenerSpy).not.toHaveBeenCalled();

    removeListenerSpy.mockRestore();
  });

  it("ignores non-oauth messages", () => {
    const popup = {
      closed: false,
      close: vi.fn(),
      get location(): Location {
        throw new DOMException("cross-origin");
      },
    } as unknown as Window;

    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    monitorOAuthPopup(popup, { onSuccess, onFailure });

    // Send a non-OAuth message
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "unrelated-event" } })
    );

    vi.advanceTimersByTime(300);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();

    // Send a non-object message
    window.dispatchEvent(new MessageEvent("message", { data: "string-data" }));

    vi.advanceTimersByTime(300);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});
