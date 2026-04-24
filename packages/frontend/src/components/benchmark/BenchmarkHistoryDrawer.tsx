import { createEffect, For, onCleanup, Show, type Component } from 'solid-js';
import type { BenchmarkHistoryRunSummary } from '../../services/api.js';
import { formatRelativeTime, formatTime } from '../../services/formatters.js';
import { XIcon } from './icons.jsx';

interface Props {
  open: boolean;
  loading: boolean;
  runs: BenchmarkHistoryRunSummary[];
  activeRunId: string | null;
  onClose: () => void;
  onSelect: (runId: string) => void;
}

interface Group {
  label: string;
  runs: BenchmarkHistoryRunSummary[];
}

/** Bucket runs into Today / Yesterday / Earlier based on created_at. */
function groupRuns(runs: BenchmarkHistoryRunSummary[]): Group[] {
  const today: BenchmarkHistoryRunSummary[] = [];
  const yesterday: BenchmarkHistoryRunSummary[] = [];
  const earlier: BenchmarkHistoryRunSummary[] = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  for (const r of runs) {
    const t = new Date(r.createdAt).getTime();
    if (t >= startOfToday) today.push(r);
    else if (t >= startOfYesterday) yesterday.push(r);
    else earlier.push(r);
  }
  const out: Group[] = [];
  if (today.length > 0) out.push({ label: 'Today', runs: today });
  if (yesterday.length > 0) out.push({ label: 'Yesterday', runs: yesterday });
  if (earlier.length > 0) out.push({ label: 'Earlier', runs: earlier });
  return out;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const BenchmarkHistoryDrawer: Component<Props> = (props) => {
  createEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  return (
    <Show when={props.open}>
      <div class="benchmark-history__backdrop" role="presentation" onClick={props.onClose} />
      <aside
        class="benchmark-history benchmark-history--open"
        aria-label="Benchmark history"
        role="dialog"
        aria-modal="true"
      >
        <header class="benchmark-history__header">
          <h2 class="benchmark-history__title">History</h2>
          <button
            type="button"
            class="benchmark-history__close"
            aria-label="Close history"
            onClick={props.onClose}
          >
            <XIcon size={18} />
          </button>
        </header>

        <div class="benchmark-history__body">
          <Show when={!props.loading && props.runs.length === 0}>
            <p class="benchmark-history__empty">No past runs yet. Run a prompt to save one here.</p>
          </Show>
          <Show when={props.loading}>
            <p class="benchmark-history__empty">Loading…</p>
          </Show>

          <For each={groupRuns(props.runs)}>
            {(group) => (
              <section class="benchmark-history__group">
                <h3 class="benchmark-history__group-label">{group.label}</h3>
                <ul class="benchmark-history__list">
                  <For each={group.runs}>
                    {(run) => (
                      <li>
                        <button
                          type="button"
                          class="benchmark-history__item"
                          classList={{
                            'benchmark-history__item--active': run.id === props.activeRunId,
                          }}
                          onClick={() => props.onSelect(run.id)}
                          title={formatTime(run.createdAt)}
                        >
                          <span class="benchmark-history__when">
                            {formatRelativeTime(run.createdAt)}
                          </span>
                          <span class="benchmark-history__prompt">
                            "{truncate(run.prompt, 64)}"
                          </span>
                          <span class="benchmark-history__meta">
                            {run.modelCount} model{run.modelCount === 1 ? '' : 's'}
                            <Show when={run.models.length > 0}>
                              {' · '}
                              {run.models.slice(0, 2).join(', ')}
                              <Show when={run.models.length > 2}>
                                {`, +${run.models.length - 2}`}
                              </Show>
                            </Show>
                          </span>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>
        </div>
      </aside>
    </Show>
  );
};

export default BenchmarkHistoryDrawer;
