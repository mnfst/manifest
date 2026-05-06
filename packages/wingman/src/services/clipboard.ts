export interface CopyOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Robust clipboard write that works inside iframes where
 * `navigator.clipboard.writeText` is often blocked by the embedder's
 * permission policy. Falls back to a hidden textarea + `execCommand('copy')`,
 * which still works under user-gesture context even when the modern API
 * isn't permitted.
 */
export async function copyText(text: string): Promise<CopyOutcome> {
  // Path 1: modern clipboard API.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch {
    // Fall through to the legacy path.
  }

  // Path 2: legacy execCommand. Requires the textarea to be in the DOM,
  // visible-ish (off-screen is fine), focused, and selected — all done
  // inside the same user-gesture stack.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return { ok: true };
    return { ok: false, reason: 'Browser denied the copy command.' };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Unknown clipboard failure',
    };
  }
}
