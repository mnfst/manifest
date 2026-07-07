import { render } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import ConnectionDetailSkeleton from '../../src/components/ConnectionDetailSkeleton';

describe('ConnectionDetailSkeleton', () => {
  it('renders skeleton placeholders for all page sections', () => {
    const { container } = render(() => <ConnectionDetailSkeleton />);
    // Hidden from screen readers
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    // Has skeleton elements
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(10);
    // Chart card
    expect(container.querySelectorAll('.chart-card')).toHaveLength(1);
    expect(container.querySelectorAll('.chart-card__body')).toHaveLength(1);
    // Three panels: Recent Messages, Models, Harnesses
    expect(container.querySelectorAll('.panel')).toHaveLength(3);
    // Three data tables with skeleton rows
    expect(container.querySelectorAll('.data-table')).toHaveLength(3);
    // Panel titles match the real page
    const titles = container.querySelectorAll('.panel__title');
    expect(titles).toHaveLength(3);
    expect(titles[0]!.textContent).toBe('Recent Messages');
    expect(titles[1]!.textContent).toBe('Models');
    expect(titles[2]!.textContent).toBe('Harnesses');
  });
});
