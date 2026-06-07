import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';

const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
	useLocation: vi.fn(() => ({ search: '' })),
	useNavigate: vi.fn(() => mockNavigate),
}));

import CostByModelTable from './CostByModelTable';

function row(overrides: Record<string, unknown> = {}) {
	return {
		model: 'gpt-4',
		tokens: 1000,
		share_pct: 50,
		estimated_cost: 0.03,
		auth_type: 'api_key',
		provider: 'openai',
		...overrides,
	};
}

describe('CostByModelTable sort', () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it('renders default sort by cost desc', () => {
		const { container } = render(() => (
			<CostByModelTable
				rows={[
					row({ model: 'cheap', estimated_cost: 0.5 }),
					row({ model: 'pricey', estimated_cost: 5 }),
					row({ model: 'mid', estimated_cost: 2 }),
				]}
				customProviderName={() => undefined}
			/>
		));
		const firstCells = Array.from(container.querySelectorAll('tbody tr td:first-child')).map(
			(td) => td.textContent?.trim() ?? '',
		);
		// Sort is by cost desc, so: pricey, mid, cheap.
		expect(firstCells[0]).toContain('pricey');
		expect(firstCells[1]).toContain('mid');
		expect(firstCells[2]).toContain('cheap');
	});
});
