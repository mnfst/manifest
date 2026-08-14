import { createSignal, For, Show, type Component } from 'solid-js';
import type { PlaygroundColumn as ColumnData } from '../../services/playground-store.js';
import { formatCost, formatDuration, formatNumber } from '../../services/formatters.js';
import { providerIcon } from '../ProviderIcon.jsx';
import { resolveProviderId } from '../../services/routing-utils.js';
import MarkdownContent from './MarkdownContent.jsx';

interface Props {
  column: ColumnData;
  isCheapest: boolean;
  isFastest: boolean;
  isBest?: boolean;
  readOnly?: boolean;
  onRemove: (id: string) => void;
  onChangeModel: (id: string) => void;
  onRetry: (id: string) => void;
  /** Toggle this column as the user's best answer. Absent ⇒ not actionable. */
  onMarkBest?: () => void;
}

const StarIcon: Component<{ filled: boolean }> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill={props.filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
    viewBox="0 0 24 24"
  >
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
  </svg>
);

function providerIdFor(column: ColumnData): string {
  return resolveProviderId(column.provider) ?? column.provider.toLowerCase();
}

const PlaygroundColumn: Component<Props> = (props) => {
  const metricsDash = '—';

  return (
    <section
      class="playground-column"
      role="region"
      aria-label={`Response from ${props.column.displayName}`}
    >
      <header class="playground-column__header">
        <Show
          when={!props.readOnly}
          fallback={
            <div class="playground-column__title playground-column__title--readonly">
              <span class="playground-column__title-left">
                <span class="playground-column__icon">
                  {providerIcon(providerIdFor(props.column), 18)}
                </span>
                <span class="playground-column__name">{props.column.displayName}</span>
              </span>
            </div>
          }
        >
          <button
            type="button"
            class="playground-column__title"
            onClick={() => props.onChangeModel(props.column.id)}
            title="Change model"
          >
            <span class="playground-column__title-left">
              <span class="playground-column__icon">
                {providerIcon(providerIdFor(props.column), 18)}
              </span>
              <span class="playground-column__name">{props.column.displayName}</span>
            </span>
            <span class="playground-column__edit-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M5 21h14c1.1 0 2-.9 2-2v-7h-2v7H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2" />
                <path d="M7 13v3c0 .55.45 1 1 1h3c.27 0 .52-.11.71-.29l9-9a.996.996 0 0 0 0-1.41l-3-3a.996.996 0 0 0-1.41 0l-9.01 8.99A1 1 0 0 0 7 13m10-7.59L18.59 7 17.5 8.09 15.91 6.5zm-8 8 5.5-5.5 1.59 1.59-5.5 5.5H9z" />
              </svg>
            </span>
          </button>
        </Show>
        <Show when={props.column.status === 'success' && props.onMarkBest}>
          <button
            type="button"
            class="playground-column__best"
            classList={{ 'playground-column__best--on': !!props.isBest }}
            aria-pressed={!!props.isBest}
            aria-label={
              props.isBest
                ? `Unmark ${props.column.displayName} as best answer`
                : `Mark ${props.column.displayName} as best answer`
            }
            title={props.isBest ? 'Your best answer' : 'Mark as best answer'}
            onClick={() => props.onMarkBest?.()}
          >
            <StarIcon filled={!!props.isBest} />
          </button>
        </Show>
        <Show when={props.column.status === 'success' && !props.onMarkBest && props.isBest}>
          <span
            class="playground-column__best playground-column__best--on playground-column__best--static"
            title="Your best answer"
            aria-label={`${props.column.displayName} was marked the best answer`}
          >
            <StarIcon filled={true} />
          </span>
        </Show>
        <Show when={!props.readOnly}>
          <button
            type="button"
            class="playground-column__remove"
            aria-label={`Remove ${props.column.displayName}`}
            onClick={() => props.onRemove(props.column.id)}
          >
            ×
          </button>
        </Show>
      </header>

      <div class="playground-column__body">
        <Show when={props.column.status === 'idle'}>
          <p class="playground-column__placeholder">Type a prompt below to run this model.</p>
        </Show>
        <Show when={props.column.status === 'loading' && !props.column.response}>
          <div class="playground-column__skeleton" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        </Show>
        <Show
          when={
            props.column.status === 'success' ||
            (props.column.status === 'loading' && props.column.response)
          }
        >
          <MarkdownContent class="playground-column__response" text={props.column.response ?? ''} />
        </Show>
        <Show when={props.column.status === 'error'}>
          <div class="playground-column__error" role="alert">
            <span class="playground-column__error-text">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M11 7h2v6h-2zm0 8h2v2h-2z" />
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M5 19V5h14v14z" />
              </svg>
              {props.column.error}
            </span>
            <Show when={!props.readOnly}>
              <button
                type="button"
                class="btn btn--sm btn--primary"
                onClick={() => props.onRetry(props.column.id)}
              >
                Retry
              </button>
            </Show>
          </div>
        </Show>
      </div>

      <footer class="playground-column__metrics" aria-label="Response metrics">
        <div class="playground-column__metric">
          <span class="playground-column__metric-label">Cost</span>
          <span class="playground-column__metric-value-row">
            <span class="playground-column__metric-value">
              {props.column.metrics?.cost != null
                ? (formatCost(props.column.metrics.cost) ?? metricsDash)
                : metricsDash}
            </span>
            <Show when={props.isCheapest && props.column.status === 'success'}>
              <span class="playground-column__win-badge" title="Cheapest model for this request">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9.09V6c0-.55-.45-1-1-1h-3.09L12.7 2.79a.996.996 0 0 0-1.41 0L9.08 5H5.99c-.55 0-1 .45-1 1v3.09L2.78 11.3a.996.996 0 0 0 0 1.41l2.21 2.21v3.09c0 .55.45 1 1 1h3.09l2.21 2.21c.2.2.45.29.71.29s.51-.1.71-.29l2.21-2.21h3.09c.55 0 1-.45 1-1v-3.09l2.21-2.21a.996.996 0 0 0 0-1.41l-2.21-2.21Zm-8 6.33-2.71-2.71L9.7 11.3l1.29 1.29 3.29-3.29 1.41 1.41-4.71 4.71Z" />
                </svg>
              </span>
            </Show>
          </span>
        </div>
        <div class="playground-column__metric">
          <span class="playground-column__metric-label">Output</span>
          <span class="playground-column__metric-value">
            {props.column.metrics ? formatNumber(props.column.metrics.outputTokens) : metricsDash}
          </span>
        </div>
        <div class="playground-column__metric">
          <span class="playground-column__metric-label">Duration</span>
          <span class="playground-column__metric-value-row">
            <span class="playground-column__metric-value">
              {props.column.metrics ? formatDuration(props.column.metrics.durationMs) : metricsDash}
            </span>
            <Show when={props.isFastest && props.column.status === 'success'}>
              <span class="playground-column__win-badge" title="Fastest model for this request">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9.09V6c0-.55-.45-1-1-1h-3.09L12.7 2.79a.996.996 0 0 0-1.41 0L9.08 5H5.99c-.55 0-1 .45-1 1v3.09L2.78 11.3a.996.996 0 0 0 0 1.41l2.21 2.21v3.09c0 .55.45 1 1 1h3.09l2.21 2.21c.2.2.45.29.71.29s.51-.1.71-.29l2.21-2.21h3.09c.55 0 1-.45 1-1v-3.09l2.21-2.21a.996.996 0 0 0 0-1.41l-2.21-2.21Zm-8 6.33-2.71-2.71L9.7 11.3l1.29 1.29 3.29-3.29 1.41 1.41-4.71 4.71Z" />
                </svg>
              </span>
            </Show>
          </span>
        </div>
      </footer>

      <Show when={props.column.headers && Object.keys(props.column.headers).length > 0}>
        {(() => {
          const [open, setOpen] = createSignal(false);
          return (
            <div class="playground-column__headers">
              <button
                type="button"
                class="playground-column__headers-toggle"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open()}
              >
                <span>Response headers</span>
                <svg
                  class="playground-column__headers-caret"
                  classList={{ 'playground-column__headers-caret--open': open() }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.35 8H6.65c-.64 0-.99.76-.56 1.24l5.35 6.11c.3.34.83.34 1.13 0l5.35-6.11C18.34 8.76 18 8 17.36 8Z" />
                </svg>
              </button>
              <Show when={open()}>
                <dl class="playground-column__headers-list">
                  <For each={Object.entries(props.column.headers ?? {})}>
                    {([k, v]) => (
                      <>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </>
                    )}
                  </For>
                </dl>
              </Show>
            </div>
          );
        })()}
      </Show>
    </section>
  );
};

export default PlaygroundColumn;
