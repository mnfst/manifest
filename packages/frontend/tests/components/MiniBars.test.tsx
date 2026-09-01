import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import MiniBars from '../../src/components/MiniBars';

describe('MiniBars', () => {
  it('draws one bar per value, scaled to the largest', () => {
    const { container } = render(() => <MiniBars data={[0, 5, 10]} width={30} height={20} />);
    const rects = Array.from(container.querySelectorAll('rect'));
    expect(rects.length).toBe(3);
    // (30 - 2 gaps * 2px) / 3 bars
    expect(rects.map((r) => r.getAttribute('x'))).toEqual(['0', '10.666666666666666', '21.333333333333332']);
    // A zero value still shows a 1px stub so the day reads as present.
    expect(rects.map((r) => r.getAttribute('height'))).toEqual(['1', '10', '20']);
    expect(rects[2]!.getAttribute('y')).toBe('0');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to the default size and handles an empty series', () => {
    const { container } = render(() => <MiniBars data={[]} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('74');
    expect(svg.getAttribute('height')).toBe('22');
    expect(container.querySelectorAll('rect').length).toBe(0);
  });
});
