import { render } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import ProviderConnectionsSkeleton from '../../src/components/ProviderConnectionsSkeleton';

describe('ProviderConnectionsSkeleton', () => {
  it('renders skeleton placeholders for connections table and provider grid', () => {
    const { container } = render(() => <ProviderConnectionsSkeleton />);
    // Hidden from screen readers
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    // Skeleton elements present
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(10);
    // Connections table with 10 skeleton rows
    const table = container.querySelector('.data-table');
    expect(table).toBeTruthy();
    expect(table!.querySelectorAll('tbody tr')).toHaveLength(10);
    // Supported providers grid (8 cards)
    expect(container.querySelectorAll('.panel')).toHaveLength(9); // 1 table panel + 8 grid cards
  });
});
