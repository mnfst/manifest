/**
 * Monitors an OAuth popup window for a result using three strategies:
 * 1. BroadcastChannel (works when COOP severs window.opener)
 * 2. postMessage (works when window.opener is preserved)
 * 3. URL polling (fallback for strict cross-origin policies)
 */
export function monitorOAuthPopup(
  popup: Window,
  callbacks: { onSuccess: () => void; onFailure: () => void },
): void {
  let handled = false;
  let bc: BroadcastChannel | null = null;
  let bcTimeout: ReturnType<typeof setTimeout> | undefined;

  const fullCleanup = () => {
    window.removeEventListener('message', onMessage);
    try {
      bc?.close();
    } catch {
      /* already closed */
    }
    clearTimeout(bcTimeout);
  };

  const handleResult = (success: boolean) => {
    if (handled) return;
    handled = true;
    clearInterval(pollRef);
    fullCleanup();
    try {
      popup.close();
    } catch {
      /* COOP may prevent close */
    }
    if (success) callbacks.onSuccess();
    else callbacks.onFailure();
  };

  const isOAuthMessage = (data: unknown): data is { type: string } =>
    !!data && typeof data === 'object' && 'type' in data;

  const handleMessage = (data: unknown) => {
    if (!isOAuthMessage(data)) return;
    if (data.type === 'manifest-oauth-success') handleResult(true);
    else if (data.type === 'manifest-oauth-error') handleResult(false);
  };

  // BroadcastChannel: works even when COOP severs window.opener
  let pollRef: ReturnType<typeof setInterval>;
  try {
    bc = new BroadcastChannel('manifest-oauth');
    bc.onmessage = (event: MessageEvent) => handleMessage(event.data);
  } catch {
    /* BroadcastChannel not supported -- fall through to other methods */
  }

  // postMessage fallback (works when window.opener is preserved)
  const onMessage = (event: MessageEvent) => handleMessage(event.data);
  window.addEventListener('message', onMessage);

  // URL polling fallback
  pollRef = setInterval(() => {
    try {
      const doneUrl = popup.location?.href;
      if (doneUrl?.includes('/oauth/openai/done')) {
        const ok = new URL(doneUrl).searchParams.get('ok') === '1';
        handleResult(ok);
      }
    } catch {
      // Cross-origin -- popup is still on auth.openai.com, keep polling
    }
    // COOP makes popup.closed true immediately -- only stop polling,
    // keep BroadcastChannel alive so the done page message is received.
    if (popup.closed && !handled) {
      clearInterval(pollRef);
      bcTimeout = setTimeout(() => {
        if (!handled) {
          fullCleanup();
        }
      }, 5 * 60_000);
    }
  }, 300);
}
