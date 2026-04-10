import { Show, type JSX } from 'solid-js';
import { A } from '@solidjs/router';
import type { MessageRow, MessageColumnKey } from './message-table-types.js';
import InfoTooltip from './InfoTooltip.jsx';
import {
  formatCost,
  formatErrorMessage,
  formatNumber,
  formatStatus,
  formatTime,
  formatDuration,
  customProviderColor,
} from '../services/formatters.js';
import {
  inferProviderFromModel,
  inferProviderName,
  resolveProviderId,
  stripCustomPrefix,
} from '../services/routing-utils.js';
import { PROVIDERS } from '../services/providers.js';
import { getModelDisplayName } from '../services/model-display.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.jsx';
import { authBadgeFor, authLabel } from './AuthBadge.js';

const MONO = 'font-family: var(--font-mono);';
const MONO_XS =
  'font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));';

export function HeartbeatIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function FallbackIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="margin-right: 3px; flex-shrink: 0;"
      aria-hidden="true"
    >
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

const HEADER_LABELS: Record<MessageColumnKey, string> = {
  date: 'Date',
  message: 'Message',
  cost: 'Cost',
  totalTokens: 'Tokens',
  input: 'Input',
  output: 'Output',
  model: 'Model',
  cache: 'Cache',
  duration: 'Duration',
  status: 'Status',
};

const TOOLTIP_TEXT: Partial<Record<MessageColumnKey, string>> = {
  totalTokens: 'Tokens are units of text that AI models process. More tokens = higher cost.',
  input: "Tokens sent to the model (your prompt). Also called 'input tokens'.",
  output: "Tokens returned by the model (its response). Also called 'output tokens'.",
};

export function columnHeader(key: MessageColumnKey, tooltips?: boolean): JSX.Element {
  const label = key === 'totalTokens' && tooltips ? 'Total Tokens' : HEADER_LABELS[key];
  const tip = TOOLTIP_TEXT[key];
  return tip && (tooltips || key !== 'totalTokens') ? (
    <>
      {label}
      <InfoTooltip text={tip} />
    </>
  ) : (
    <>{label}</>
  );
}

export function DateCell(item: MessageRow): JSX.Element {
  return <td style={`white-space: nowrap; ${MONO_XS}`}>{formatTime(item.timestamp)}</td>;
}

export function MessageCell(item: MessageRow): JSX.Element {
  return (
    <td style={MONO_XS}>
      {item.id.slice(0, 8)}
      {item.routing_reason === 'heartbeat' && (
        <span
          title="Heartbeat"
          style="display: inline-flex; align-items: center; margin-left: 4px; color: hsl(var(--muted-foreground)); opacity: 0.7;"
        >
          {<HeartbeatIcon />}
        </span>
      )}
    </td>
  );
}

export function CostCell(item: MessageRow): JSX.Element {
  return (
    <td style={MONO}>
      <Show
        when={item.auth_type === 'subscription'}
        fallback={
          <span
            title={
              item.cost != null && item.cost > 0 && item.cost < 0.01
                ? `$${item.cost.toFixed(6)}`
                : undefined
            }
          >
            {item.cost != null ? (formatCost(item.cost) ?? '\u2014') : '\u2014'}
          </span>
        }
      >
        <span style="color: hsl(var(--muted-foreground));" title="Included in subscription">
          $0.00
        </span>
      </Show>
    </td>
  );
}

/**
 * Resolve the provider ID for a message row. Prefers the stored `provider`
 * column (populated by the proxy from routing resolution) over inference from
 * the model name prefix, which is ambiguous for subscription providers like
 * Ollama Cloud whose catalog includes models named after other vendors
 * (e.g. `deepseek-v3.2`, `kimi-k2:1t`, `gemma4:31b`).
 */
function resolveMessageProvider(item: MessageRow): string | undefined {
  if (item.provider) {
    const resolved = resolveProviderId(item.provider);
    if (resolved) return resolved;
  }
  if (item.model) return inferProviderFromModel(item.model);
  return undefined;
}

function resolveMessageProviderName(item: MessageRow): string | undefined {
  const id = resolveMessageProvider(item);
  if (!id) return undefined;
  return (
    PROVIDERS.find((p) => p.id === id)?.name ?? (item.model ? inferProviderName(item.model) : id)
  );
}

export function ModelCell(
  item: MessageRow,
  customProviderName: (m: string) => string | undefined,
): JSX.Element {
  const provId = resolveMessageProvider(item);
  const provName = resolveMessageProviderName(item);
  // Custom providers are identified by either the literal 'custom' (from
  // inferProviderFromModel on a `custom:...` model name) or by a stored
  // provider column of the form `custom:<uuid>` (from resolveProviderId,
  // which returns custom-prefixed IDs unchanged).
  const isCustomProvider = provId === 'custom' || provId?.startsWith('custom:') === true;
  return (
    <td style={MONO_XS}>
      <span style="display: inline-flex; align-items: center; gap: 4px;">
        {item.model && isCustomProvider ? (
          (() => {
            const customName = customProviderName(item.model!);
            const logo = customProviderLogo(
              customName ?? '',
              16,
              undefined,
              item.model ?? undefined,
            );
            if (logo) return logo;
            const letter = (customName ?? stripCustomPrefix(item.model!)).charAt(0).toUpperCase();
            return (
              <span
                class="provider-card__logo-letter"
                title={customName}
                style={{
                  background: customProviderColor(customName ?? ''),
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
          })()
        ) : provId ? (
          <span
            role="img"
            aria-label={`${provName ?? provId} (${authLabel(item.auth_type)})`}
            title={`${provName ?? provId} (${authLabel(item.auth_type)})`}
            style="display: inline-flex; flex-shrink: 0; position: relative;"
          >
            {providerIcon(provId, 14)}
            {authBadgeFor(item.auth_type, 8)}
          </span>
        ) : null}
        {item.model
          ? item.model.startsWith('custom:')
            ? `custom:${customProviderName(item.model) ?? 'Custom'}/${stripCustomPrefix(item.model)}`
            : getModelDisplayName(item.model)
          : '\u2014'}
        {item.specificity_category ? (
          <span class="tier-badge tier-badge--specificity">
            {item.specificity_category.replace(/_/g, ' ')}
          </span>
        ) : item.routing_tier ? (
          <span class={`tier-badge tier-badge--${item.routing_tier}`}>{item.routing_tier}</span>
        ) : null}
        {item.fallback_from_model && (
          <span
            class="tier-badge tier-badge--fallback"
            title={`Fallback from ${getModelDisplayName(item.fallback_from_model)}`}
          >
            fallback
          </span>
        )}
      </span>
    </td>
  );
}

export function TokenCell(value: number | null): JSX.Element {
  return <td style={MONO}>{value != null ? formatNumber(value) : '\u2014'}</td>;
}

export function SmallTokenCell(value: number | null): JSX.Element {
  return <td style={MONO_XS}>{value != null ? formatNumber(value) : '\u2014'}</td>;
}

export function CacheCell(item: MessageRow): JSX.Element {
  const has = (item.cache_read_tokens ?? 0) > 0 || (item.cache_creation_tokens ?? 0) > 0;
  return (
    <td style={MONO_XS}>
      {has
        ? `Read: ${formatNumber(item.cache_read_tokens ?? 0)} / Write: ${formatNumber(item.cache_creation_tokens ?? 0)}`
        : '\u2014'}
    </td>
  );
}

export function DurationCell(item: MessageRow): JSX.Element {
  return (
    <td style={MONO_XS}>
      {item.duration_ms != null ? formatDuration(item.duration_ms) : '\u2014'}
    </td>
  );
}

export function StatusCell(
  item: MessageRow,
  agentName: string,
  onFallbackErrorClick?: (model: string) => void,
): JSX.Element {
  return (
    <td>
      <Show
        when={item.error_message}
        fallback={
          <span class={`status-badge status-badge--${item.status}`}>
            {item.status === 'fallback_error' && <FallbackIcon />}
            {item.status === 'rate_limited' ? (
              <A href={`/agents/${encodeURIComponent(agentName)}/limits`}>
                {formatStatus(item.status)}
              </A>
            ) : (
              formatStatus(item.status)
            )}
          </span>
        }
      >
        <span
          class="status-badge-tooltip"
          tabindex="0"
          role="note"
          aria-label={formatErrorMessage(item.error_message!)}
        >
          <span
            class={`status-badge status-badge--${item.status}`}
            onClick={
              item.status === 'fallback_error' && item.model && onFallbackErrorClick
                ? () => onFallbackErrorClick(item.model!)
                : undefined
            }
          >
            {item.status === 'fallback_error' && <FallbackIcon />}
            {formatStatus(item.status)}
          </span>
          <span class="status-badge-tooltip__bubble">
            {formatErrorMessage(item.error_message!)}
          </span>
        </span>
      </Show>
    </td>
  );
}

export interface CellRenderContext {
  agentName: string;
  customProviderName: (model: string) => string | undefined;
  onFallbackErrorClick?: (model: string) => void;
}

export function renderCell(
  key: MessageColumnKey,
  item: MessageRow,
  ctx: CellRenderContext,
): JSX.Element {
  switch (key) {
    case 'date':
      return DateCell(item);
    case 'message':
      return MessageCell(item);
    case 'cost':
      return CostCell(item);
    case 'totalTokens':
      return TokenCell(item.total_tokens);
    case 'input':
      return SmallTokenCell(item.input_tokens);
    case 'output':
      return SmallTokenCell(item.output_tokens);
    case 'model':
      return ModelCell(item, ctx.customProviderName);
    case 'cache':
      return CacheCell(item);
    case 'duration':
      return DurationCell(item);
    case 'status':
      return StatusCell(item, ctx.agentName, ctx.onFallbackErrorClick);
  }
}
