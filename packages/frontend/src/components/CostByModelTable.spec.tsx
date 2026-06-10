import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

const mockNavigate = vi.fn((to: string) => {
	mockSearch = to;
});
let mockSearch = '';

vi.mock('@solidjs/router', () => ({
	useLocation: vi.fn(() => ({
		get search() {
			return mockSearch;
		},
	})),
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

function rowModels() {
	return [
		row({ model: 'cheap', estimated_cost: 0.5, tokens: 100, share_pct: 5 }),
		row({ model: 'pricey', estimated_cost: 5, tokens: 900, share_pct: 90 }),
		row({ model: 'mid', estimated_cost: 2, tokens: 500, share_pct: 50 }),
	];
}

function firstColModels(container: HTMLElement) {
	return Array.from(container.querySelectorAll('tbody tr td:first-child')).map(
		(td) => td.textContent?.trim() ?? '',
	);
}

describe('CostByModelTable sort', () => {
	beforeEach(() => {
		mockNavigate.mockClear();
		mockSearch = '';
	});

	it('renders default sort by cost desc', () => {
		const { container } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const cells = firstColModels(container);
		expect(cells[0]).toContain('pricey');
		expect(cells[1]).toContain('mid');
		expect(cells[2]).toContain('cheap');
	});

	it('clicking Tokens header sorts by tokens desc and writes URL', () => {
		const { container, getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		fireEvent.click(getByText('Tokens').closest('th')!);
		const cells = firstColModels(container);
		// tokens: pricey 900, mid 500, cheap 100
		expect(cells[0]).toContain('pricey');
		expect(cells[1]).toContain('mid');
		expect(cells[2]).toContain('cheap');
		expect(mockNavigate).toHaveBeenCalledWith('?sortColumn=tokens&sortDir=desc', { replace: true });
	});

	it('second click on same column toggles asc', () => {
		const { getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const tokensHeader = getByText('Tokens').closest('th')!;
		fireEvent.click(tokensHeader);
		mockNavigate.mockClear();
		fireEvent.click(tokensHeader);
		expect(mockNavigate).toHaveBeenCalledWith('?sortColumn=tokens&sortDir=asc', { replace: true });
	});

	it('third click resets to default order (rows sorted by cost desc)', () => {
		const { container, getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const costHeader = getByText('Cost').closest('th')!;
		fireEvent.click(costHeader); // null -> cost desc
		fireEvent.click(costHeader); // desc -> asc
		fireEvent.click(costHeader); // asc -> reset
		const cells = firstColModels(container);
		// back to cost desc default
		expect(cells[0]).toContain('pricey');
		expect(cells[1]).toContain('mid');
		expect(cells[2]).toContain('cheap');
	});

	it('switching column resets previous sort', () => {
		const { getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		fireEvent.click(getByText('Cost').closest('th')!);
		mockNavigate.mockClear();
		fireEvent.click(getByText('Tokens').closest('th')!);
		expect(mockNavigate).toHaveBeenCalledWith('?sortColumn=tokens&sortDir=desc', { replace: true });
	});

	it('aria-sort reflects current state', () => {
		const { getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const tokensHeader = getByText('Tokens').closest('th')!;
		expect(tokensHeader.getAttribute('aria-sort')).toBeNull();
		fireEvent.click(tokensHeader);
		expect(tokensHeader.getAttribute('aria-sort')).toBe('descending');
		fireEvent.click(tokensHeader);
		expect(tokensHeader.getAttribute('aria-sort')).toBe('ascending');
	});

	it('hydrates from valid URL params', () => {
		mockSearch = '?sortColumn=share_pct&sortDir=asc';
		const { container } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const cells = firstColModels(container);
		// share_pct asc: cheap 5, mid 50, pricey 90
		expect(cells[0]).toContain('cheap');
		expect(cells[1]).toContain('mid');
		expect(cells[2]).toContain('pricey');
	});

	it('invalid URL params ignored, defaults to cost desc', () => {
		mockSearch = '?sortColumn=invalid&sortDir=up';
		const { container } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const cells = firstColModels(container);
		expect(cells[0]).toContain('pricey');
	});

	it('shows sort indicator only on active column', () => {
		const { container, getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		fireEvent.click(getByText('Tokens').closest('th')!);
		const arrows = container.querySelectorAll('th span[aria-hidden="true"]');
		expect(arrows).toHaveLength(1);
		expect(arrows[0]?.textContent).toBe('↓');
	});

	it('keyboard Enter on header triggers sort', () => {
		const { getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const tokensHeader = getByText('Tokens').closest('th')!;
		fireEvent.keyDown(tokensHeader, { key: 'Enter' });
		expect(mockNavigate).toHaveBeenCalledWith('?sortColumn=tokens&sortDir=desc', { replace: true });
	});

	it('keyboard Space on header triggers sort', () => {
		const { getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const tokensHeader = getByText('Tokens').closest('th')!;
		fireEvent.keyDown(tokensHeader, { key: ' ' });
		expect(mockNavigate).toHaveBeenCalledWith('?sortColumn=tokens&sortDir=desc', { replace: true });
	});

	it('inactive headers omit aria-sort', () => {
		const { getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const tokensHeader = getByText('Tokens').closest('th')!;
		expect(tokensHeader.getAttribute('aria-sort')).toBeNull();
		const costHeader = getByText('Cost').closest('th')!;
		expect(costHeader.getAttribute('aria-sort')).toBeNull();
		fireEvent.click(tokensHeader);
		expect(tokensHeader.getAttribute('aria-sort')).toBe('descending');
		expect(costHeader.getAttribute('aria-sort')).toBeNull();
	});

	it('reset clears URL params entirely', () => {
		const { getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		const costHeader = getByText('Cost').closest('th')!;
		fireEvent.click(costHeader);
		mockNavigate.mockClear();
		fireEvent.click(costHeader);
		mockNavigate.mockClear();
		fireEvent.click(costHeader);
		// third click resets to null sortColumn
		expect(mockNavigate).toHaveBeenCalledWith('', { replace: true });
	});

	it('handles null/undefined sort values gracefully', () => {
		const rowsWithNulls = rowModels().map((r, i) => {
			if (i === 0) return { ...r, tokens: null as unknown as number, share_pct: null as unknown as number };
			return r;
		});
		const { container, getByText } = render(() => (
			<CostByModelTable rows={rowsWithNulls} customProviderName={() => undefined} />
		));
		fireEvent.click(getByText('Tokens').closest('th')!);
		// should not throw; null treated as 0
		const cells = firstColModels(container);
		expect(cells).toHaveLength(3);
	});

	it('hydrates with invalid sortDir defaults to desc', () => {
		mockSearch = '?sortColumn=tokens&sortDir=invalid';
		const { container, getByText } = render(() => (
			<CostByModelTable rows={rowModels()} customProviderName={() => undefined} />
		));
		fireEvent.click(getByText('Tokens').closest('th')!);
		// was desc, click -> asc
		expect(mockNavigate).toHaveBeenCalledWith('?sortColumn=tokens&sortDir=asc', { replace: true });
	});
});
