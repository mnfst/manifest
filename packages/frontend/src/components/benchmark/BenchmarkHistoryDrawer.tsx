import { createSignal, For, Show, type Component } from 'solid-js';
import type { BenchmarkHistoryRunSummary } from '../../services/api.js';
import { toggleBenchmarkRunStar } from '../../services/api.js';

interface Group {
  label: string;
  runs: BenchmarkHistoryRunSummary[];
}

/** Bucket runs into Today / Previous 7 Days / Older based on created_at. */
function groupRuns(runs: BenchmarkHistoryRunSummary[]): Group[] {
  const today: BenchmarkHistoryRunSummary[] = [];
  const week: BenchmarkHistoryRunSummary[] = [];
  const older: BenchmarkHistoryRunSummary[] = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startOfToday - 7 * 86_400_000;
  for (const r of runs) {
    const t = new Date(r.createdAt).getTime();
    if (t >= startOfToday) today.push(r);
    else if (t >= sevenDaysAgo) week.push(r);
    else older.push(r);
  }
  const out: Group[] = [];
  if (today.length > 0) out.push({ label: 'Today', runs: today });
  if (week.length > 0) out.push({ label: 'Previous 7 days', runs: week });
  if (older.length > 0) out.push({ label: 'Older', runs: older });
  return out;
}

const SidebarPanelIcon: Component<{ size?: number }> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 20}
    height={props.size ?? 20}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2M4 6h8v12H4zm10 12V6h6v12z" />
    <path d="M16 12h2v2h-2zm0-4h2v2h-2z" />
  </svg>
);

const StarIcon: Component<{ size?: number; filled?: boolean }> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 14}
    height={props.size ?? 14}
    viewBox="0 0 24 24"
    fill={props.filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const MoreIcon: Component<{ size?: number }> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

interface Props {
  open: boolean;
  loading: boolean;
  runs: BenchmarkHistoryRunSummary[];
  activeRunId: string | null;
  onToggle: () => void;
  onSelect: (runId: string) => void;
  onStarToggle?: (runId: string, starred: boolean) => void;
  onNewBenchmark?: () => void;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const RunItem: Component<{
  run: BenchmarkHistoryRunSummary;
  isActive: boolean;
  onSelect: () => void;
  onStarToggle?: (runId: string, starred: boolean) => void;
}> = (props) => {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [starred, setStarred] = createSignal(props.run.starred);

  const handleStar = async (e: MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      const newVal = await toggleBenchmarkRunStar(props.run.id);
      setStarred(newVal);
      props.onStarToggle?.(props.run.id, newVal);
    } catch {
      // silent
    }
  };

  return (
    <li
      class="benchmark-recent__item-wrapper"
      classList={{ 'benchmark-recent__item--active': props.isActive }}
    >
      <button type="button" class="benchmark-recent__item" onClick={props.onSelect}>
        <span class="benchmark-recent__prompt">{truncate(props.run.prompt, 50)}</span>
      </button>
      <div class="benchmark-recent__fade" />
      <div class="benchmark-recent__menu-anchor">
        <button
          type="button"
          class="benchmark-recent__more"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="Options"
        >
          <MoreIcon size={14} />
        </button>
        <Show when={menuOpen()}>
          <div class="benchmark-recent__menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div class="benchmark-recent__menu">
            <button type="button" class="benchmark-recent__menu-item" onClick={handleStar}>
              <StarIcon size={14} filled={starred()} />
              {starred() ? 'Unstar' : 'Star'}
            </button>
          </div>
        </Show>
      </div>
    </li>
  );
};

const BenchmarkRecentSidebar: Component<Props> = (props) => {
  const starredRuns = () => props.runs.filter((r) => r.starred);
  const timeGroups = () => groupRuns(props.runs);

  return (
    <>
      <Show when={!props.open}>
        <div class="benchmark-recent--collapsed">
          <button
            type="button"
            class="benchmark-recent__toggle"
            onClick={props.onToggle}
            aria-label="Show recent runs"
            title="Show recent runs"
          >
            <SidebarPanelIcon size={18} />
          </button>
        </div>
      </Show>
      <Show when={props.open}>
        <aside class="benchmark-recent" aria-label="Benchmark history">
          <header class="benchmark-recent__header">
            <h2 class="benchmark-recent__title">My Benchmarks</h2>
            <button
              type="button"
              class="benchmark-recent__collapse"
              onClick={props.onToggle}
              aria-label="Hide benchmarks"
            >
              <SidebarPanelIcon size={18} />
            </button>
          </header>

          <button
            type="button"
            class="benchmark-recent__new"
            onClick={() => props.onNewBenchmark?.()}
          >
            <span class="benchmark-recent__new-left">
              <span class="benchmark-recent__new-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 13h8v8h2v-8h8v-2h-8V3h-2v8H3z" />
                </svg>
              </span>
              <span class="benchmark-recent__new-label">New benchmark</span>
            </span>
            <kbd class="benchmark-recent__new-shortcut">
              <span>{navigator.platform?.includes('Mac') ? '⇧' : 'Shift'}</span>
              <span>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}</span>
              <span>O</span>
            </kbd>
          </button>

          <div class="benchmark-recent__body">
            <Show when={!props.loading && props.runs.length === 0}>
              <p class="benchmark-recent__empty">
                No runs yet. Send a prompt to see your history here.
              </p>
            </Show>
            <Show when={props.loading}>
              <p class="benchmark-recent__empty">Loading…</p>
            </Show>

            <Show when={starredRuns().length > 0}>
              <section class="benchmark-recent__group">
                <h3 class="benchmark-recent__group-label">Starred</h3>
                <ul class="benchmark-recent__list">
                  <For each={starredRuns()}>
                    {(run) => (
                      <RunItem
                        run={run}
                        isActive={run.id === props.activeRunId}
                        onSelect={() => props.onSelect(run.id)}
                        onStarToggle={props.onStarToggle}
                      />
                    )}
                  </For>
                </ul>
              </section>
            </Show>

            <For each={timeGroups()}>
              {(group) => (
                <section class="benchmark-recent__group">
                  <h3 class="benchmark-recent__group-label">{group.label}</h3>
                  <ul class="benchmark-recent__list">
                    <For each={group.runs}>
                      {(run) => (
                        <RunItem
                          run={run}
                          isActive={run.id === props.activeRunId}
                          onSelect={() => props.onSelect(run.id)}
                          onStarToggle={props.onStarToggle}
                        />
                      )}
                    </For>
                  </ul>
                </section>
              )}
            </For>
          </div>
        </aside>
      </Show>
    </>
  );
};

export default BenchmarkRecentSidebar;
