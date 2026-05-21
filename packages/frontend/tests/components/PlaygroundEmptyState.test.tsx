import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import PlaygroundEmptyState from '../../src/components/playground/PlaygroundEmptyState';

describe('PlaygroundEmptyState', () => {
  it('renders the no-providers copy and fires onConnect when the button is clicked', () => {
    const onConnect = vi.fn();
    const { container } = render(() => <PlaygroundEmptyState onConnect={onConnect} />);

    expect(container.textContent).toContain('No providers connected');
    expect(container.textContent).toContain('run your models side by side');

    const btn = container.querySelector('button.btn--primary') as HTMLButtonElement | null;
    expect(btn?.textContent?.trim()).toBe('Connect provider');
    fireEvent.click(btn!);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
