import { For, Show, type Component } from 'solid-js';
import type { BenchmarkColumn as ColumnData } from '../../services/benchmark-store.js';
import { formatCost, formatDuration, formatNumber } from '../../services/formatters.js';
import { providerIcon } from '../ProviderIcon.jsx';
import { resolveProviderId, inferProviderFromModel } from '../../services/routing-utils.js';
import MarkdownContent from './MarkdownContent.jsx';
import { LockIcon } from './icons.jsx';

interface Props {
  column: ColumnData;
  isCheapest: boolean;
  isFastest: boolean;
  onRemove: (id: string) => void;
  onChangeModel: (id: string) => void;
  onRetry: (id: string) => void;
}

function providerIdFor(column: ColumnData): string {
  return (
    inferProviderFromModel(column.model) ??
    resolveProviderId(column.provider) ??
    column.provider.toLowerCase()
  );
}

const BenchmarkColumn: Component<Props> = (props) => {
  const metricsDash = '—';

  const isOriginal = () => props.column.isOriginal === true;

  return (
    <section
      class="benchmark-column"
      classList={{ 'benchmark-column--original': isOriginal() }}
      role="region"
      aria-label={
        isOriginal()
          ? `Original recorded response from ${props.column.displayName}`
          : `Response from ${props.column.displayName}`
      }
    >
      <header class="benchmark-column__header">
        <Show
          when={!isOriginal()}
          fallback={
            <div class="benchmark-column__title benchmark-column__title--static">
              <span class="benchmark-column__icon">
                {providerIcon(providerIdFor(props.column), 18)}
              </span>
              <span class="benchmark-column__name">{props.column.displayName}</span>
              <span class="benchmark-column__chip benchmark-column__chip--original">Original</span>
            </div>
          }
        >
          <button
            type="button"
            class="benchmark-column__title"
            onClick={() => props.onChangeModel(props.column.id)}
            title="Change model"
          >
            <span class="benchmark-column__icon">
              {providerIcon(providerIdFor(props.column), 18)}
            </span>
            <span class="benchmark-column__name">{props.column.displayName}</span>
          </button>
        </Show>
        <Show
          when={!isOriginal()}
          fallback={
            <span
              class="benchmark-column__remove benchmark-column__remove--locked"
              aria-disabled="true"
              title="Original recording — pinned baseline"
            >
              <LockIcon size={14} />
            </span>
          }
        >
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
          <p class="benchmark-column__placeholder">
            {isOriginal()
              ? 'Original recorded response.'
              : 'Type a prompt below to run this model.'}
          </p>
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
            <p>{props.column.error}</p>
            <button type="button" onClick={() => props.onRetry(props.column.id)}>
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
