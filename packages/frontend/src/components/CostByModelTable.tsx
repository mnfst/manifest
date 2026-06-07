import { createEffect, createMemo, createSignal, For, onMount, untrack, type Component } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import { authBadgeFor, authLabel } from './AuthBadge.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.jsx';
import { customProviderColor, formatCost, formatNumber } from '../services/formatters.js';
import { getModelDisplayName } from '../services/model-display.js';
import {
	inferProviderFromModel,
	inferProviderName,
	resolveProviderId,
	stripCustomPrefix,
} from '../services/routing-utils.js';
import { PROVIDERS } from '../services/providers.js';

interface CostByModelRow {
	model: string;
	display_name?: string;
	tokens: number;
	share_pct: number;
	estimated_cost: number;
	auth_type: string | null;
	provider?: string | null;
}

interface CostByModelTableProps {
	rows: CostByModelRow[];
	customProviderName: (model: string) => string | undefined;
}

type SortColumn = 'tokens' | 'share_pct' | 'estimated_cost';
type SortDir = 'asc' | 'desc';

const VALID_COLUMNS = ['tokens', 'share_pct', 'estimated_cost'] as const;
const VALID_DIRS = ['asc', 'desc'] as const;

function resolveRowProvider(row: CostByModelRow): string | undefined {
	if (row.provider) {
		const resolved = resolveProviderId(row.provider);
		if (resolved) return resolved;
	}
	if (row.model) return inferProviderFromModel(row.model);
	return undefined;
}

function resolveRowProviderName(row: CostByModelRow): string | undefined {
	const id = resolveRowProvider(row);
	if (!id) return undefined;
	return (
		PROVIDERS.find((p) => p.id === id)?.name ?? (row.model ? inferProviderName(row.model) : id)
	);
}

function parseUrlParams(search: string): { col: SortColumn | null; dir: SortDir } {
	const params = new URLSearchParams(search);
	const col = params.get('sortColumn');
	const dir = params.get('sortDir');
	return {
		col: col !== null && VALID_COLUMNS.includes(col as SortColumn) ? (col as SortColumn) : null,
		dir: dir !== null && VALID_DIRS.includes(dir as SortDir) ? (dir as SortDir) : 'desc',
	};
}

function headerSortKey(
	activeCol: SortColumn | null,
	column: SortColumn,
	dir: SortDir,
): 'ascending' | 'descending' | undefined {
	if (activeCol !== column) return undefined;
	return dir === 'asc' ? 'ascending' : 'descending';
}

const CostByModelTable: Component<CostByModelTableProps> = (props) => {
	const [sortColumn, setSortColumn] = createSignal<SortColumn | null>(null);
	const [sortDir, setSortDir] = createSignal<SortDir>('desc');
	const location = useLocation();
	const navigate = useNavigate();

	// Sync URL -> signals (back/forward navigation)
	createEffect(() => {
		const { col, dir } = parseUrlParams(location.search);
		setSortColumn(col);
		setSortDir(dir);
	});

	// Sync signals -> URL (untrack prevents back/forward overwrites)
	createEffect(() => {
		const col = sortColumn();
		const dir = sortDir();
		const currentSearch = untrack(() => location.search);
		const params = new URLSearchParams();
		if (col) {
			params.set('sortColumn', col);
			params.set('sortDir', dir);
		}
		const newSearch = params.toString() ? `?${params.toString()}` : '';
		if (currentSearch !== newSearch) {
			navigate(newSearch, { replace: true });
		}
	});

	const handleSort = (col: SortColumn) => {
		if (sortColumn() === col) {
			if (sortDir() === 'desc') {
				setSortDir('asc');
			} else {
				setSortColumn(null);
				setSortDir('desc');
			}
		} else {
			setSortColumn(col);
			setSortDir('desc');
		}
	};

	const handleSortKey = (e: KeyboardEvent, col: SortColumn) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleSort(col);
		}
	};

	const sortedRows = createMemo(() => {
		const col = sortColumn();
		const dir = sortDir();
		const rows = [...props.rows];
		if (!col) {
			return rows.sort((a, b) => b.estimated_cost - a.estimated_cost);
		}
		return rows.sort((a, b) => {
			const av = a[col] ?? 0;
			const bv = b[col] ?? 0;
			if (av === bv) return a.model.localeCompare(b.model);
			const cmp = av < bv ? -1 : 1;
			return dir === 'asc' ? cmp : -cmp;
		});
	});

	return (
		<div class="panel" style="margin-top: var(--gap-lg);">
			<div class="panel__title">Cost by Model</div>
			<p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin: -8px 0 12px;">
				How much each model costs you
			</p>
			<table class="data-table">
				<thead>
					<tr>
						<th>Model</th>
						<th
							role="button"
							tabIndex={0}
							onClick={() => handleSort('tokens')}
							onKeyDown={(e) => handleSortKey(e, 'tokens')}
							style="cursor: pointer;"
							aria-sort={headerSortKey(sortColumn(), 'tokens', sortDir())}
						>
							Tokens
							{sortColumn() === 'tokens' && (
								<span aria-hidden="true" style="margin-left: 4px;">
									{sortDir() === 'asc' ? '↑' : '↓'}
								</span>
							)}
						</th>
						<th
							role="button"
							tabIndex={0}
							onClick={() => handleSort('share_pct')}
							onKeyDown={(e) => handleSortKey(e, 'share_pct')}
							style="cursor: pointer;"
							aria-sort={headerSortKey(sortColumn(), 'share_pct', sortDir())}
						>
							% of total
							{sortColumn() === 'share_pct' && (
								<span aria-hidden="true" style="margin-left: 4px;">
									{sortDir() === 'asc' ? '↑' : '↓'}
								</span>
							)}
						</th>
						<th
							role="button"
							tabIndex={0}
							onClick={() => handleSort('estimated_cost')}
							onKeyDown={(e) => handleSortKey(e, 'estimated_cost')}
							style="cursor: pointer;"
							aria-sort={headerSortKey(sortColumn(), 'estimated_cost', sortDir())}
						>
							Cost
							{sortColumn() === 'estimated_cost' && (
								<span aria-hidden="true" style="margin-left: 4px;">
									{sortDir() === 'asc' ? '↑' : '↓'}
								</span>
							)}
						</th>
					</tr>
				</thead>
				<tbody>
					<For each={sortedRows()}>
						{(row) => (
							<tr>
								<td style="font-family: var(--font-mono); font-size: var(--font-size-sm);">
									<span style="display: inline-flex; align-items: center; gap: 4px;">
										{(() => {
											const provId = resolveRowProvider(row);
											const isCustom =
												provId === 'custom' || provId?.startsWith('custom:') === true;
											if (row.model && isCustom) {
												const provName = props.customProviderName(row.model);
												const logo = customProviderLogo(
													provName ?? '',
													16,
													undefined,
													row.model ?? undefined,
												);
												if (logo) return logo;
												const letter = (provName ?? stripCustomPrefix(row.model))
													.charAt(0)
													.toUpperCase();
												const provNameForTitle = provName ?? '';
												return (
													<span
														class="provider-card__logo-letter"
														title={provNameForTitle || undefined}
														style={{
															background: customProviderColor(provNameForTitle),
															width: '16px',
															height: '16px',
															'font-size': '9px',
															'flex-shrink': '0',
															'border-radius': '50%',
														}}
													>
														{letter}
													</span>
												);
											}
											if (provId) {
												const provName = resolveRowProviderName(row);
												return (
													<span
														title={`${provName ?? provId} (${authLabel(row.auth_type)})`}
														style="display: inline-flex; flex-shrink: 0; position: relative;"
													>
														{providerIcon(provId, 14)}
														{authBadgeFor(row.auth_type, 8)}
													</span>
												);
											}
											return null;
										})()}
										{row.model
											? row.model.startsWith('custom:')
												? `custom:${props.customProviderName(row.model) ?? 'Custom'}/${stripCustomPrefix(row.model)}`
												: row.display_name || getModelDisplayName(row.model)
											: row.model}
									</span>
								</td>
								<td>{formatNumber(row.tokens)}</td>
								<td>
									<div style="display: flex; align-items: center; gap: 8px;">
										<div style="width: 40px; height: 4px; border-radius: 2px; background: hsl(var(--muted)); overflow: hidden;">
											<div
												style={`width: ${row.share_pct}%; height: 100%; background: hsl(var(--chart-1)); border-radius: 2px;`}
											/>
										</div>
										<span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
											{Math.round(row.share_pct)}%
										</span>
									</div>
								</td>
								<td
									style="font-weight: 600;"
									title={
										row.estimated_cost > 0 && row.estimated_cost < 0.01
											? `$${row.estimated_cost.toFixed(6)}`
											: undefined
									}
								>
									{formatCost(row.estimated_cost) ?? '—'}
								</td>
							</tr>
						)}
					</For>
				</tbody>
			</table>
		</div>
	);
};

export default CostByModelTable;
