import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import OutputControls from '../../src/components/OutputControls';

describe('OutputControls', () => {
  it('switches response response mode and shows the saving state', async () => {
    let resolveChange: () => void = () => {};
    const [mode, setMode] = createSignal<'buffered' | 'stream'>('buffered');
    const onResponseModeChange = vi.fn(
      (next: 'buffered' | 'stream') =>
        new Promise<void>((resolve) => {
          resolveChange = () => {
            setMode(next);
            resolve();
          };
        }),
    );

    const { container } = render(() => (
      <OutputControls responseMode={mode} onResponseModeChange={onResponseModeChange} />
    ));

    fireEvent.click(screen.getByText('Stream'));

    await waitFor(() => {
      expect(onResponseModeChange).toHaveBeenCalledWith('stream');
      expect(container.querySelector('.spinner')).not.toBeNull();
    });

    resolveChange();

    await waitFor(() => {
      expect(container.querySelector('.spinner')).toBeNull();
      expect(
        screen.getByText('Stream').classList.contains('output-controls__segment--active'),
      ).toBe(true);
    });
  });

  it('does not call the handler for the selected or disabled mode', () => {
    const onResponseModeChange = vi.fn();
    const { unmount } = render(() => (
      <OutputControls responseMode={() => 'buffered'} onResponseModeChange={onResponseModeChange} />
    ));

    fireEvent.click(screen.getByText('Buffered'));
    expect(onResponseModeChange).not.toHaveBeenCalled();

    unmount();

    render(() => (
      <OutputControls
        responseMode={() => 'buffered'}
        disabled={() => true}
        onResponseModeChange={onResponseModeChange}
      />
    ));

    fireEvent.click(screen.getByText('Stream'));

    expect(onResponseModeChange).not.toHaveBeenCalled();
  });
});
