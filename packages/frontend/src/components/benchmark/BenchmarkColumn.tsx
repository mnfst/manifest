import { For, Show, type Component } from 'solid-js';
import type { BenchmarkColumn as ColumnData } from '../../services/benchmark-store.js';
import { formatCost, formatDuration, formatNumber } from '../../services/formatters.js';
import { providerIcon } from '../ProviderIcon.jsx';
import { resolveProviderId } from '../../services/routing-utils.js';
import MarkdownContent from './MarkdownContent.jsx';

interface Props {
  column: ColumnData;
  isCheapest: boolean;
  isFastest: boolean;
  readOnly?: boolean;
  onRemove: (id: string) => void;
  onChangeModel: (id: string) => void;
  onRetry: (id: string) => void;
}

function providerIdFor(column: ColumnData): string {
  return resolveProviderId(column.provider) ?? column.provider.toLowerCase();
}

const BenchmarkColumn: Component<Props> = (props) => {
  const metricsDash = '—';

  return (
    <section
      class="benchmark-column"
      role="region"
      aria-label={`Response from ${props.column.displayName}`}
    >
      <header class="benchmark-column__header">
        <Show
          when={!props.readOnly}
          fallback={
            <div class="benchmark-column__title benchmark-column__title--readonly">
              <span class="benchmark-column__title-left">
                <span class="benchmark-column__icon">
                  {providerIcon(providerIdFor(props.column), 18)}
                </span>
                <span class="benchmark-column__name">{props.column.displayName}</span>
              </span>
            </div>
          }
        >
          <button
            type="button"
            class="benchmark-column__title"
            onClick={() => props.onChangeModel(props.column.id)}
            title="Change model"
          >
            <span class="benchmark-column__title-left">
              <span class="benchmark-column__icon">
                {providerIcon(providerIdFor(props.column), 18)}
              </span>
              <span class="benchmark-column__name">{props.column.displayName}</span>
            </span>
            <span class="benchmark-column__edit-icon">
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
        <Show when={!props.readOnly}>
          <button
            type="button"
            class="benchmark-column__remove"
            aria-label={`Remove ${props.column.displayName}`}
            onClick={() => props.onRemove(props.column.id)}
          >
            ×
          </button>
        </Show>
      </header>

      <div class="benchmark-column__body">
        <Show when={props.column.status === 'idle'}>
          <p class="benchmark-column__placeholder">Type a prompt below to run this model.</p>
        </Show>
        <Show when={props.column.status === 'loading'}>
          <div class="benchmark-column__skeleton" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        </Show>
        <Show when={props.column.status === 'success'}>
          <MarkdownContent class="benchmark-column__response" text={props.column.response ?? ''} />
        </Show>
        <Show when={props.column.status === 'error'}>
          <div class="benchmark-column__error" role="alert">
            <span class="benchmark-column__error-text">
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
            <button
              type="button"
              class="btn btn--sm btn--primary"
              onClick={() => props.onRetry(props.column.id)}
            >
              Retry
            </button>
          </div>
        </Show>
      </div>

      <footer class="benchmark-column__metrics" aria-label="Response metrics">
        <div class="benchmark-column__metric">
          <span class="benchmark-column__metric-label">Cost</span>
          <span class="benchmark-column__metric-value">
            {props.column.metrics?.cost != null
              ? (formatCost(props.column.metrics.cost) ?? metricsDash)
              : metricsDash}
          </span>
          <Show when={props.isCheapest && props.column.status === 'success'}>
            <span class="benchmark-column__win-chip benchmark-column__win-chip--cost">
              Cheapest
            </span>
          </Show>
        </div>
        <div class="benchmark-column__metric">
          <span class="benchmark-column__metric-label">Output</span>
          <span class="benchmark-column__metric-value">
            {props.column.metrics ? formatNumber(props.column.metrics.outputTokens) : metricsDash}
          </span>
        </div>
        <div class="benchmark-column__metric">
          <span class="benchmark-column__metric-label">Duration</span>
          <span class="benchmark-column__metric-value">
            {props.column.metrics ? formatDuration(props.column.metrics.durationMs) : metricsDash}
          </span>
          <Show when={props.isFastest && props.column.status === 'success'}>
            <span class="benchmark-column__win-chip benchmark-column__win-chip--speed">
              Fastest
            </span>
          </Show>
        </div>
      </footer>

      <Show when={props.column.headers && Object.keys(props.column.headers).length > 0}>
        <details class="benchmark-column__headers">
          <summary>Response headers</summary>
          <dl>
            <For each={Object.entries(props.column.headers ?? {})}>
              {([k, v]) => (
                <>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </>
              )}
            </For>
          </dl>
        </details>
      </Show>
    </section>
  );
};

export default BenchmarkColumn;
