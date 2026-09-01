import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import CostBarChart from '../../src/components/CostBarChart';

describe('CostBarChart', () => {
  it('renders one bar per value with the axis labels and an accessible total', () => {
    const { container } = render(() => (
      <CostBarChart
        values={[1, 2, 3.5]}
        labels={['1 Aug', '14 Aug', '26 Aug']}
        ariaLabel="Daily cost, last 30 days"
      />
    ));
    expect(container.querySelectorAll('rect').length).toBe(3);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Daily cost, last 30 days. Total 6.50.',
    );
    expect(container.querySelector('.bar-chart__axis')?.textContent).toBe('1 Aug14 Aug26 Aug');
    // The last bar is full opacity, earlier ones are dimmed.
    const rects = container.querySelectorAll('rect');
    expect(rects[2]!.getAttribute('opacity')).toBe('1');
    expect(rects[0]!.getAttribute('opacity')).toBe('0.75');
  });

  it('honours the colour, height and formatter', () => {
    const { container } = render(() => (
      <CostBarChart
        values={[10, 20, 30]}
        labels={['1', '2']}
        format={(v) => `$${v.toFixed(0)}`}
        color="hsl(var(--chart-1))"
        height={60}
        ariaLabel="Cost"
      />
    ));
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Cost. Total $60.');
    expect(container.querySelector('rect')?.getAttribute('fill')).toBe('hsl(var(--chart-1))');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 320 60');
    expect(container.querySelector('title')?.textContent).toBe('$10');
  });

  it('shows the empty message without values', () => {
    const { container } = render(() => <CostBarChart values={[]} labels={[]} ariaLabel="Cost" />);
    expect(container.textContent).toContain('No data for this period yet.');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('keeps a visible 1px bar for zero values', () => {
    const { container } = render(() => (
      <CostBarChart values={[0, 0]} labels={['a']} ariaLabel="Cost" />
    ));
    expect(container.querySelector('rect')?.getAttribute('height')).toBe('1.00');
  });
});
