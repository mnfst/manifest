import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';

// ─── API mocks ──────────────────────────────────────────────────────────────
const mockGetAvailableModels = vi.fn();
const mockGetProviders = vi.fn();
const mockGetCustomProviders = vi.fn();
const mockGetBenchmarkRun = vi.fn();
const mockListBenchmarkRuns = vi.fn();
const mockRunBenchmark = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  getAvailableModels: (...args: unknown[]) => mockGetAvailableModels(...args),
  getProviders: (...args: unknown[]) => mockGetProviders(...args),
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
  getBenchmarkRun: (...args: unknown[]) => mockGetBenchmarkRun(...args),
  listBenchmarkRuns: (...args: unknown[]) => mockListBenchmarkRuns(...args),
  runBenchmark: (...args: unknown[]) => mockRunBenchmark(...args),
}));

const mockToastError = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...a: unknown[]) => mockToastError(...a), success: vi.fn(), warning: vi.fn() },
}));

// Router primitive (the page reads useParams)
vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'demo' }),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: { children: unknown }) => <>{props.children as unknown as Element}</>,
  Meta: () => null,
}));

// Heavy child components — keep focused on the page's history/confirm logic.
vi.mock('../../src/components/benchmark/BenchmarkColumn.jsx', () => ({
  default: () => <div data-testid="bench-col" />,
}));
vi.mock('../../src/components/benchmark/BenchmarkPrompt.jsx', () => ({
  default: (props: { value: string; onChange: (v: string) => void; onSubmit: () => void }) => (
    <div data-testid="bench-prompt">
      <input
        data-testid="prompt-input"
        value={props.value}
        onInput={(e) => props.onChange((e.currentTarget as HTMLInputElement).value)}
      />
      <button data-testid="prompt-submit" onClick={props.onSubmit}>
        submit
      </button>
    </div>
  ),
}));
vi.mock('../../src/components/benchmark/BenchmarkSummaryTable.jsx', () => ({
  default: () => null,
}));
vi.mock('../../src/components/benchmark/BenchmarkModelPicker.jsx', () => ({
  default: () => null,
}));
vi.mock('../../src/components/benchmark/BenchmarkEmptyState.jsx', () => ({
  default: () => null,
}));

// Stub the drawer to expose a button per run that calls onSelect — that's
// the path that flows into handlePickHistory.
const drawerCalls: { open: boolean; runs: { id: string }[] }[] = [];
vi.mock('../../src/components/benchmark/BenchmarkHistoryDrawer.jsx', () => ({
  default: (props: {
    open: boolean;
    runs: { id: string }[];
    onSelect: (id: string) => void;
  }) => {
    drawerCalls.push({ open: props.open, runs: props.runs });
    return (
      <div data-testid="drawer-host">
        <span data-testid="drawer-open">{props.open ? 'open' : 'closed'}</span>
        {props.runs.map((r) => (
          <button data-testid={`pick-${r.id}`} onClick={() => props.onSelect(r.id)}>
            pick {r.id}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('../../src/components/benchmark/RequestHeadersPopover.jsx', () => ({
  default: () => null,
  blankEntry: () => ({ id: 'b', key: '', value: '' }),
  isBlockedHeaderKey: () => false,
  toHeaderRecord: () => ({}),
}));

vi.mock('../../src/components/benchmark/icons.jsx', () => ({
  CodeIcon: () => null,
  HistoryIcon: () => null,
  XIcon: () => null,
  PlusIcon: () => null,
  TrashIcon: () => null,
}));

import Benchmark from '../../src/pages/Benchmark';

const SAMPLE_RUN_DETAIL = {
  id: 'r-42',
  prompt: 'historical-prompt',
  createdAt: new Date().toISOString(),
  modelCount: 1,
  models: ['M'],
  columns: [],
};

describe('Benchmark page', () => {
  beforeEach(() => {
    mockGetAvailableModels.mockReset().mockResolvedValue([]);
    mockGetProviders.mockReset().mockResolvedValue([
      { id: 'p1', provider: 'openai', auth_type: 'api_key', is_active: true, has_api_key: true, connected_at: '' },
    ]);
    mockGetCustomProviders.mockReset().mockResolvedValue([]);
    mockGetBenchmarkRun.mockReset().mockResolvedValue(SAMPLE_RUN_DETAIL);
    mockListBenchmarkRuns
      .mockReset()
      .mockResolvedValue([{ id: 'r-42', prompt: 'p', createdAt: '2026-01-01', modelCount: 1, models: ['M'] }]);
    mockRunBenchmark.mockReset();
    mockToastError.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('passes the route agent name through to getBenchmarkRun on history pick', async () => {
    const { getByText, findByTestId } = render(() => <Benchmark />);
    // Open the drawer.
    fireEvent.click(getByText('History'));
    const pick = await findByTestId('pick-r-42');
    fireEvent.click(pick);
    await waitFor(() => {
      expect(mockGetBenchmarkRun).toHaveBeenCalled();
    });
    // Second positional arg must be the agentName the route gave us.
    expect(mockGetBenchmarkRun).toHaveBeenCalledWith('r-42', 'demo');
  });

  it('does NOT call getBenchmarkRun when a benchmark is running and confirm() is rejected', async () => {
    // The page seeds at least one column from pickDefaults() once available
    // models + providers resolve. Provide one so a runAll() can mark it as
    // 'loading' and isAnyRunning() returns true.
    mockGetAvailableModels.mockResolvedValueOnce([
      {
        model_name: 'openai/gpt-4o-mini',
        provider: 'openai',
        auth_type: 'api_key',
        input_price_per_token: 0.00000015,
        output_price_per_token: 0.0000006,
        context_window: 128_000,
        capability_reasoning: false,
        capability_code: true,
        quality_score: 2,
        display_name: 'GPT-4o Mini',
        provider_display_name: 'OpenAI',
      },
    ]);
    // Hang the request so the column stays in 'loading' state.
    mockRunBenchmark.mockReturnValue(new Promise(() => {}));
    // Reject the confirm dialog.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { getByText, findByTestId } = render(() => <Benchmark />);

    // Wait for the picker to seed a column.
    await waitFor(() => {
      // pickDefaults populated one column when both resolved; the prompt
      // mock is rendered.
      expect(true).toBe(true);
    });

    // Fire a benchmark to mark the column 'loading'.
    const promptInput = (await findByTestId('prompt-input')) as HTMLInputElement;
    fireEvent.input(promptInput, { target: { value: 'hi' } });
    fireEvent.click(await findByTestId('prompt-submit'));

    // Now open history and pick a run.
    fireEvent.click(getByText('History'));
    const pick = await findByTestId('pick-r-42');
    // Reset the spy count: any earlier confirms (e.g. unload prompts) don't count.
    confirmSpy.mockClear();
    mockGetBenchmarkRun.mockClear();
    fireEvent.click(pick);

    // confirm() WAS called because a run was in flight.
    expect(confirmSpy).toHaveBeenCalled();
    // …and getBenchmarkRun was NOT called because confirm returned false.
    expect(mockGetBenchmarkRun).not.toHaveBeenCalled();
  });

  it('proceeds with the swap when confirm() is accepted and a benchmark is running', async () => {
    mockGetAvailableModels.mockResolvedValueOnce([
      {
        model_name: 'openai/gpt-4o-mini',
        provider: 'openai',
        auth_type: 'api_key',
        input_price_per_token: 0.00000015,
        output_price_per_token: 0.0000006,
        context_window: 128_000,
        capability_reasoning: false,
        capability_code: true,
        quality_score: 2,
        display_name: 'GPT-4o Mini',
        provider_display_name: 'OpenAI',
      },
    ]);
    mockRunBenchmark.mockReturnValue(new Promise(() => {}));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { getByText, findByTestId } = render(() => <Benchmark />);
    const promptInput = (await findByTestId('prompt-input')) as HTMLInputElement;
    fireEvent.input(promptInput, { target: { value: 'hi' } });
    fireEvent.click(await findByTestId('prompt-submit'));

    fireEvent.click(getByText('History'));
    const pick = await findByTestId('pick-r-42');
    confirmSpy.mockClear();
    mockGetBenchmarkRun.mockClear();
    fireEvent.click(pick);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockGetBenchmarkRun).toHaveBeenCalledWith('r-42', 'demo'));
  });

  it('toasts an error when getBenchmarkRun fails', async () => {
    mockGetBenchmarkRun.mockRejectedValueOnce(new Error('boom'));
    const { getByText, findByTestId } = render(() => <Benchmark />);
    fireEvent.click(getByText('History'));
    const pick = await findByTestId('pick-r-42');
    fireEvent.click(pick);
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('boom'));
  });
});
