import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import {
  HistoryIcon,
  CodeIcon,
  XIcon,
  PlusIcon,
  TrashIcon,
} from '../../src/components/benchmark/icons';

describe('benchmark icons', () => {
  it('renders the X, Plus, and Trash icons', () => {
    const { container } = render(() => (
      <div>
        <XIcon />
        <PlusIcon />
        <TrashIcon />
      </div>
    ));
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(3);
    for (const svg of svgs) expect(svg.getAttribute('width')).toBe('16');
  });

  it('renders HistoryIcon with default size and a forwarded class', () => {
    const { container } = render(() => <HistoryIcon class="hist" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('class')).toBe('hist');
    expect(svg?.querySelectorAll('path').length).toBe(3);
  });

  it('renders CodeIcon with an explicit size', () => {
    const { container } = render(() => <CodeIcon size={24} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(svg?.querySelectorAll('path').length).toBe(2);
  });
});
