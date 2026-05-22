import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@solidjs/testing-library';

/* ── Mock ResizeObserver ─────────────────────────────────────── */

type ROCallback = (entries: Array<{ contentRect: { height: number } }>) => void;
let roCallback: ROCallback | null = null;
const roDisconnect = vi.fn();

class MockResizeObserver {
  constructor(cb: ROCallback) {
    roCallback = cb;
  }
  observe() {}
  disconnect() {
    roDisconnect();
  }
  unobserve() {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

import PlaygroundPrompt from '../../../src/components/playground/PlaygroundPrompt';

/* ── Tests ───────────────────────────────────────────────────── */

describe('PlaygroundPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roCallback = null;
  });

  it('adds the --history-open class when historyOpen is true', () => {
    const { container } = render(() => (
      <PlaygroundPrompt
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onRecallPrevious={vi.fn()}
        disabled={false}
        running={false}
        historyOpen={true}
      />
    ));
    const wrapper = container.querySelector('.playground-prompt-wrapper');
    expect(wrapper!.classList.contains('playground-prompt-wrapper--history-open')).toBe(true);
  });

  it('does NOT add the --history-open class when historyOpen is false', () => {
    const { container } = render(() => (
      <PlaygroundPrompt
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onRecallPrevious={vi.fn()}
        disabled={false}
        running={false}
        historyOpen={false}
      />
    ));
    const wrapper = container.querySelector('.playground-prompt-wrapper');
    expect(wrapper!.classList.contains('playground-prompt-wrapper--history-open')).toBe(false);
  });

  it('calls onHeightChange when the ResizeObserver fires and disconnects on cleanup', () => {
    const onHeightChange = vi.fn();
    const { unmount } = render(() => (
      <PlaygroundPrompt
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onRecallPrevious={vi.fn()}
        disabled={false}
        running={false}
        onHeightChange={onHeightChange}
      />
    ));

    // Simulate a resize observation
    expect(roCallback).not.toBeNull();
    roCallback!([{ contentRect: { height: 200 } }]);
    expect(onHeightChange).toHaveBeenCalledWith(200);

    // Unmount triggers onCleanup which calls ro.disconnect()
    unmount();
    expect(roDisconnect).toHaveBeenCalled();
  });

  it('mounts without error when onHeightChange is not provided (ResizeObserver not created)', () => {
    roCallback = null;
    render(() => (
      <PlaygroundPrompt
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onRecallPrevious={vi.fn()}
        disabled={false}
        running={false}
      />
    ));
    // No ResizeObserver created because onHeightChange is undefined
    expect(roCallback).toBeNull();
  });
});
