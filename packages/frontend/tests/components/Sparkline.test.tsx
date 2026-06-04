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
    expect(paths.length).toBe(2);
    // Verify area path (first path with fill gradient)
    expect(paths[0]!.getAttribute('fill')).toBeTruthy();
    expect(paths[0]!.getAttribute('fill')).toContain('url(#');
    // Verify line path (second path with stroke)
    expect(paths[1]!.getAttribute('stroke')).toBeTruthy();
    expect(paths[1]!.getAttribute('fill')).toBe('none');
  });

  it('renders empty SVG for no data', () => {
    const { container } = render(() => <Sparkline data={[]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(container.querySelectorAll('path').length).toBe(0);
    // No gradient defs should be rendered either
    expect(container.querySelectorAll('linearGradient').length).toBe(0);
  });

  it('applies custom dimensions', () => {
    const { container } = render(() => <Sparkline data={[1, 2]} width={100} height={25} />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('100');
    expect(svg!.getAttribute('height')).toBe('25');
  });

  it('handles single data point', () => {
    // Single point hits stepX = w() / Math.max(0, 1) = w() / 1 fallback.
    // Should not throw or produce NaN coordinates.
    const { container } = render(() => <Sparkline data={[5]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
    // Path data must not contain NaN
    expect(paths[0]!.getAttribute('d')).not.toContain('NaN');
    expect(paths[1]!.getAttribute('d')).not.toContain('NaN');
  });

  it('handles all-zero data', () => {
    // All zeros hits Math.max(...points, 1) = 1 fallback to avoid divide-by-zero.
    const { container } = render(() => <Sparkline data={[0, 0, 0]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
    // Path data must not contain NaN or Infinity
    expect(paths[0]!.getAttribute('d')).not.toContain('NaN');
    expect(paths[0]!.getAttribute('d')).not.toContain('Infinity');
    expect(paths[1]!.getAttribute('d')).not.toContain('NaN');
    expect(paths[1]!.getAttribute('d')).not.toContain('Infinity');
  });

  it('applies custom color to stroke and gradient stops', () => {
    const { container } = render(() => (
      <Sparkline data={[1, 2, 3]} color="rgb(255, 0, 0)" />
    ));
    const linePath = container.querySelectorAll('path')[1];
    expect(linePath!.getAttribute('stroke')).toBe('rgb(255, 0, 0)');
    const stops = container.querySelectorAll('stop');
    expect(stops.length).toBe(2);
    expect(stops[0]!.getAttribute('stop-color')).toBe('rgb(255, 0, 0)');
    expect(stops[1]!.getAttribute('stop-color')).toBe('rgb(255, 0, 0)');
  });

  it('generates unique gradient ids across instances rendered together', () => {
    // Guards against gradient-id collisions when multiple sparklines are
    // mounted in the same container. If the id scheme regresses (e.g. a
    // constant id), the gradient fills bleed across instances.
    const { container } = render(() => (
      <>
        <Sparkline data={[1, 2, 3]} />
        <Sparkline data={[4, 5, 6]} />
        <Sparkline data={[7, 8, 9]} />
      </>
    ));
    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients.length).toBe(3);
    const ids = Array.from(gradients).map((g) => g.getAttribute('id'));
    // Every id must be a non-empty string
    for (const id of ids) {
      expect(id).toBeTruthy();
    }
    // Every id must be unique
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    // Each area path's fill must reference its sibling gradient's id
    const areaPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('fill') !== 'none',
    );
    expect(areaPaths.length).toBe(3);
    for (const path of areaPaths) {
      const fill = path.getAttribute('fill') ?? '';
      const match = fill.match(/^url\(#(.+)\)$/);
      expect(match).not.toBeNull();
      expect(ids).toContain(match![1]);
    }
  });

  it('uses default width and height when not provided', () => {
    const { container } = render(() => <Sparkline data={[1, 2, 3]} />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('200');
    expect(svg!.getAttribute('height')).toBe('50');
    expect(svg!.getAttribute('viewBox')).toBe('0 0 200 50');
  });
});
