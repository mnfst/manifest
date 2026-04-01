import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import Sparkline from '../../src/components/Sparkline';

describe('Sparkline', () => {
  it('renders an SVG with aria-hidden', () => {
    const { container } = render(() => <Sparkline data={[1, 2, 3]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders path data for non-empty data', () => {
    const { container } = render(() => <Sparkline data={[10, 20, 30]} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('renders empty SVG for no data', () => {
    const { container } = render(() => <Sparkline data={[]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(container.querySelectorAll('path').length).toBe(0);
  });

  it('applies custom dimensions', () => {
    const { container } = render(() => <Sparkline data={[1, 2]} width={100} height={25} />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('100');
    expect(svg!.getAttribute('height')).toBe('25');
  });
});
