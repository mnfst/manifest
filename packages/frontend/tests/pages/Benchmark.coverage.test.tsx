import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';

const api = {
  getAvailableModels: vi.fn(),
  getProviders: vi.fn(),
  getCustomProviders: vi.fn(),
  getBenchmarkRun: vi.fn(),
  listBenchmarkRuns: vi.fn(),
  runBenchmark: vi.fn(),
};
vi.mock('../../src/services/api.js', () => ({
  getAvailableModels: (...a: unknown[]) => api.getAvailableModels(...a),
  getProviders: (...a: unknown[]) => api.getProviders(...a),
  getCustomProviders: (...a: unknown[]) => api.getCustomProviders(...a),
  getBenchmarkRun: (...a: unknown[]) => api.getBenchmarkRun(...a),
  listBenchmarkRuns: (...a: unknown[]) => api.listBenchmarkRuns(...a),
  runBenchmark: (...a: unknown[]) => api.runBenchmark(...a),
}));

const toastError = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('@solidjs/router', () => ({ useParams: () => ({ agentName: 'demo' }) }));
vi.mock('@solidjs/meta', () => ({
  Title: (p: { children: unknown }) => <>{p.children as never}</>,
  Meta: () => null,
}));

interface ColProps {
  column: { id: string; displayName: string };
  isCheapest: boolean;
  isFastest: boolean;
  onRemove: (id: string) => void;
  onChangeModel: (id: string) => void;
  onRetry: (id: string) => void;
}
vi.mock('../../src/components/benchmark/BenchmarkColumn.jsx', () => ({
  default: (p: ColProps) => (
    <div class="mockcol" data-win={`${p.isCheapest ? 'C' : ''}${p.isFastest ? 'F' : ''}`}>
      <span class="m-name">{p.column.displayName}</span>
      <button class="m-change" onClick={() => p.onChangeModel(p.column.id)} />
      <button class="m-retry" onClick={() => p.onRetry(p.column.id)} />
      <button class="m-remove" onClick={() => p.onRemove(p.column.id)} />
    </div>
  ),
}));
interface PromptProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onRecallPrevious: () => void;
  disabled: boolean;
  running: boolean;
  headersSlot: unknown;
}
vi.mock('../../src/components/benchmark/BenchmarkPrompt.jsx', () => ({
  default: (p: PromptProps) => (
    <div class="mockprompt" data-disabled={String(p.disabled)} data-running={String(p.running)}>
      <input
        class="m-input"
        value={p.value}
        onInput={(e) => p.onChange((e.currentTarget as HTMLInputElement).value)}
      />
      <button class="m-submit" onClick={p.onSubmit} />
      <button class="m-recall" onClick={p.onRecallPrevious} />
      {p.headersSlot as never}
    </div>
  ),
}));
vi.mock('../../src/components/benchmark/BenchmarkSummaryTable.jsx', () => ({
  default: (p: { columns: readonly unknown[] }) => (
    <div class="mocksummary">{p.columns.length}</div>
  ),
}));
let pickerColId: string | undefined;
let pickerSelect: ((id: string, m: string, prov: string, a?: string) => void) | undefined;
vi.mock('../../src/components/benchmark/BenchmarkModelPicker.jsx', () => ({
  default: (p: {
    columnId: string;
    models: unknown[];
    customProviders?: unknown[];
    connectedProviders?: unknown[];
    onSelect: (id: string, m: string, prov: string, a?: string) => void;
    onClose: () => void;
  }) => {
    pickerColId = p.columnId;
    pickerSelect = p.onSelect;
    return (
      <div class="mockpicker" data-models={p.models.length}>
        <span>{`${(p.customProviders ?? []).length}/${(p.connectedProviders ?? []).length}`}</span>
        <button class="m-picker-close" onClick={p.onClose} />
      </div>
    );
  },
}));
vi.mock('../../src/components/benchmark/BenchmarkEmptyState.jsx', () => ({
  default: (p: { agentName: string }) => <div class="mockempty">{p.agentName}</div>,
}));
vi.mock('../../src/components/benchmark/BenchmarkHistoryDrawer.jsx', () => ({
  default: (p: {
    open: boolean;
    loading: boolean;
    runs: { id: string }[];
    activeRunId: string | null;
    onClose: () => void;
    onSelect: (id: string) => void;
  }) => (
    <div
      class="mockdrawer"
      data-open={String(p.open)}
      data-loading={String(p.loading)}
      data-active={p.activeRunId ?? ''}
    >
      {p.runs.map((r) => (
        <button class="m-run" data-run={r.id} onClick={() => p.onSelect(r.id)} />
      ))}
      <button class="m-drawer-close" onClick={p.onClose} />
    </div>
  ),
}));
let popoverChange: ((e: { id: string; key: string; value: string }[]) => void) | undefined;
let popoverClose: (() => void) | undefined;
vi.mock('../../src/components/benchmark/RequestHeadersPopover.jsx', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    default: (p: {
      open: boolean;
      entries: { id: string; key: string; value: string }[];
      onChange: (e: { id: string; key: string; value: string }[]) => void;
      onClose: () => void;
    }) => {
      popoverChange = p.onChange;
      popoverClose = p.onClose;
      return (
        <div class="mockpopover" data-open={String(p.open)} data-entries={p.entries.length} />
      );
    },
  };
});
vi.mock('../../src/components/benchmark/icons.jsx', () => ({
  CodeIcon: () => null,
  HistoryIcon: () => null,
}));

import Benchmark from '../../src/pages/Benchmark';

function model(over: Record<string, unknown> = {}) {
  return {
    model_name: 'openai/gpt-4o-mini',
    provider: 'openai',
    auth_type: 'api_key',
    input_price_per_token: 0.00000015,
    output_price_per_token: 0.0000006,
    context_window: 128_000,
    capability_reasoning: false,
    capability_code: true,
    quality_score: 2,
    display_name: 'GPT',
    provider_display_name: 'OpenAI',
    ...over,
  };
}
const prov = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  provider: 'openai',
  auth_type: 'api_key',
  is_active: true,
  has_api_key: true,
  connected_at: '',
  ...over,
});
const stubLS = (getItem: () => string | null, setItem: () => void = () => {}) =>
  vi.stubGlobal('localStorage', { getItem, setItem, removeItem: vi.fn() });
const q = (c: HTMLElement, s: string) => c.querySelector(s) as HTMLElement;
const qa = (c: HTMLElement, s: string) => Array.from(c.querySelectorAll(s)) as HTMLElement[];

describe('Benchmark page — coverage', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => m.mockReset());
    api.getAvailableModels.mockResolvedValue([]);
    api.getProviders.mockResolvedValue([prov()]);
    api.getCustomProviders.mockResolvedValue([{ id: 'cp1' }]);
    api.getBenchmarkRun.mockResolvedValue({
      id: 'r1', prompt: 'p', createdAt: '', modelCount: 0, models: [], columns: [],
    });
    api.listBenchmarkRuns.mockResolvedValue([
      { id: 'r1', prompt: 'p', createdAt: '', modelCount: 1, models: ['M'] },
    ]);
    toastError.mockReset();
    pickerColId = undefined;
    pickerSelect = undefined;
    popoverChange = undefined;
    popoverClose = undefined;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    stubLS(() => null);
  });

  it('reads a stored header array (mixed valid/invalid) from localStorage', async () => {
    stubLS(() =>
      JSON.stringify([
        { id: 'a', key: 'x-trace', value: '1' },
        { id: 'b', key: 'authorization', value: 'secret' },
        { id: 'c', key: '', value: '' },
        'not-an-entry',
        { id: 1, key: 'bad', value: 'x' },
      ]),
    );
    const { container } = render(() => <Benchmark />);
    await waitFor(() => expect(q(container, '.mockprompt')).toBeTruthy());
  });

  it('returns [] for non-array stored headers and for invalid JSON', async () => {
    stubLS(() => '{}');
    const a = render(() => <Benchmark />);
    await waitFor(() => expect(q(a.container, '.mockprompt')).toBeTruthy());
    a.unmount();
    stubLS(() => 'not json{');
    const b = render(() => <Benchmark />);
    await waitFor(() => expect(q(b.container, '.mockprompt')).toBeTruthy());
  });

  it('opens/closes the headers popover, persists, and swallows persist failures', async () => {
    const setItem = vi.fn();
    stubLS(() => null, setItem);
    const { container } = render(() => <Benchmark />);
    await waitFor(() => expect(q(container, '.mockprompt')).toBeTruthy());

    fireEvent.click(q(container, '[aria-label="Request headers"]'));
    expect(typeof popoverChange).toBe('function');

    popoverChange!([
      { id: 'a', key: 'x-trace', value: '1' },
      { id: 'b', key: 'authorization', value: 's' },
      { id: 'c', key: 'k', value: '' },
    ]);
    expect(setItem).toHaveBeenCalled();
    await waitFor(() =>
      expect(q(container, '.benchmark-prompt__headers-badge').textContent).toBe('1'),
    );

    fireEvent.click(q(container, '[aria-label="Request headers"]')); // open → close
    fireEvent.click(q(container, '[aria-label="Request headers"]')); // close → open (non-empty)
    popoverClose!();

    stubLS(() => null, () => {
      throw new Error('quota');
    });
    popoverChange!([{ id: 'z', key: 'x-id', value: '9' }]);
  });

  it('runs a 2-model benchmark: winners, announcement, retry, recall, remove', async () => {
    api.getAvailableModels.mockResolvedValue([
      model({ model_name: 'openai/gpt-4o-mini', provider: 'openai', display_name: 'GPT' }),
      model({ model_name: 'claude-3-5-sonnet', provider: 'anthropic', display_name: 'Claude' }),
    ]);
    api.getProviders.mockResolvedValue([
      prov({ id: 'p1', provider: 'openai' }),
      prov({ id: 'p2', provider: 'anthropic' }),
    ]);
    let n = 0;
    api.runBenchmark.mockImplementation(() => {
      n += 1;
      return Promise.resolve({
        content: `resp ${n}`,
        metrics: { cost: n * 0.001, inputTokens: 5, outputTokens: 10, durationMs: n * 100 },
        headers: {},
      });
    });
    const { container } = render(() => <Benchmark />);
    await waitFor(() => expect(qa(container, '.mockcol').length).toBe(2));

    fireEvent.input(q(container, '.m-input'), { target: { value: 'compare' } });
    fireEvent.click(q(container, '.m-submit'));

    // First column ran first (n=1) → cheapest + fastest.
    await waitFor(() =>
      expect(qa(container, '.mockcol')[0]!.getAttribute('data-win')).toBe('CF'),
    );
    await waitFor(() => expect(api.listBenchmarkRuns).toHaveBeenCalled());

    api.runBenchmark.mockResolvedValueOnce({
      content: 'again',
      metrics: { cost: 0.0005, inputTokens: 1, outputTokens: 2, durationMs: 20 },
      headers: { 'x-h': '1' },
    });
    fireEvent.click(qa(container, '.m-retry')[0]!);
    await waitFor(() => expect(api.runBenchmark).toHaveBeenCalledTimes(3));

    fireEvent.click(q(container, '.m-recall'));
    fireEvent.click(qa(container, '.m-remove')[1]!);
    await waitFor(() => expect(qa(container, '.mockcol').length).toBe(1));
  });

  it('opens the per-column picker and the add picker (select + close)', async () => {
    api.getAvailableModels.mockResolvedValue([
      model({ model_name: 'openai/gpt-4o-mini', provider: 'openai', display_name: 'GPT' }),
      model({ model_name: 'claude-3-5-sonnet', provider: 'anthropic', display_name: 'Claude' }),
    ]);
    api.getProviders.mockResolvedValue([
      prov({ id: 'p1', provider: 'openai' }),
      prov({ id: 'p2', provider: 'anthropic' }),
    ]);
    const { container } = render(() => <Benchmark />);
    await waitFor(() => expect(qa(container, '.mockcol').length).toBe(2));

    fireEvent.click(qa(container, '.m-change')[0]!);
    await waitFor(() => expect(q(container, '.mockpicker')).toBeTruthy());
    // model present in available → findDisplayName match path.
    pickerSelect!(pickerColId!, 'openai/gpt-4o-mini', 'openai', 'api_key');
    await waitFor(() => expect(q(container, '.mockpicker')).toBeNull());

    fireEvent.click(q(container, '[aria-label="Add model column"]'));
    await waitFor(() => expect(q(container, '.mockpicker')).toBeTruthy());
    // model NOT in available → findDisplayName falls back to the id.
    pickerSelect!('new', 'mystery/model', 'openrouter');
    await waitFor(() => expect(qa(container, '.mockcol').length).toBe(3));

    fireEvent.click(q(container, '[aria-label="Add model column"]'));
    await waitFor(() => expect(q(container, '.mockpicker')).toBeTruthy());
    fireEvent.click(q(container, '.m-picker-close'));
    await waitFor(() => expect(q(container, '.mockpicker')).toBeNull());
  });

  it('shows the empty state when no provider is connected', async () => {
    api.getProviders.mockResolvedValue([prov({ is_active: false })]);
    const { container } = render(() => <Benchmark />);
    await waitFor(() => expect(q(container, '.mockempty')?.textContent).toBe('demo'));
  });

  it('toasts when history refresh fails', async () => {
    api.listBenchmarkRuns.mockRejectedValue(new Error('hist-down'));
    const { getByText } = render(() => <Benchmark />);
    fireEvent.click(getByText('History'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('hist-down'));
  });

  it('loads a history run and marks it active', async () => {
    api.getBenchmarkRun.mockResolvedValue({
      id: 'r1', prompt: 'old', createdAt: '', modelCount: 1, models: ['M'],
      columns: [
        {
          id: 'h1', model: 'openai/gpt-4o-mini', provider: 'openai', authType: 'api_key',
          displayName: 'Hist', status: 'success', response: 'hi',
          metrics: { cost: 0.001, inputTokens: 1, outputTokens: 1, durationMs: 1 },
        },
      ],
    });
    const { container, getByText } = render(() => <Benchmark />);
    fireEvent.click(getByText('History'));
    await waitFor(() => expect(q(container, '.m-run')).toBeTruthy());
    fireEvent.click(q(container, '.m-run'));
    await waitFor(() =>
      expect(q(container, '.mockdrawer').getAttribute('data-active')).toBe('r1'),
    );
  });
});
