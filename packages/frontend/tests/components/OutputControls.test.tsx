import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import OutputControls from '../../src/components/OutputControls';

describe('OutputControls', () => {
  it('switches response delivery mode and shows the saving state', async () => {
    let resolveChange: () => void = () => {};
    const [mode, setMode] = createSignal<'buffered' | 'stream'>('buffered');
    const onDeliveryModeChange = vi.fn(
      (next: 'buffered' | 'stream') =>
        new Promise<void>((resolve) => {
          resolveChange = () => {
            setMode(next);
            resolve();
          };
        }),
    );

    const { container } = render(() => (
      <OutputControls deliveryMode={mode} onDeliveryModeChange={onDeliveryModeChange} />
    ));

    fireEvent.click(screen.getByText('Stream'));

    await waitFor(() => {
      expect(onDeliveryModeChange).toHaveBeenCalledWith('stream');
      expect(container.querySelector('.spinner')).not.toBeNull();
    });

    resolveChange();

    await waitFor(() => {
      expect(container.querySelector('.spinner')).toBeNull();
      expect(screen.getByText('Stream').classList.contains('output-controls__segment--active')).toBe(
        true,
      );
    });
  });

  it('does not call the handler for the selected or disabled mode', () => {
    const onDeliveryModeChange = vi.fn();
    const { unmount } = render(() => (
      <OutputControls deliveryMode={() => 'buffered'} onDeliveryModeChange={onDeliveryModeChange} />
    ));

    fireEvent.click(screen.getByText('Buffered'));
    expect(onDeliveryModeChange).not.toHaveBeenCalled();

    unmount();

    render(() => (
      <OutputControls
        deliveryMode={() => 'buffered'}
        disabled={() => true}
        onDeliveryModeChange={onDeliveryModeChange}
      />
    ));

    fireEvent.click(screen.getByText('Stream'));

    expect(onDeliveryModeChange).not.toHaveBeenCalled();
  });
});
