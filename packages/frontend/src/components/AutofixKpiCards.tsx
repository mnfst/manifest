import { Show, type Component, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import InfoTooltip from './InfoTooltip.jsx';
import { formatNumber } from '../services/formatters.js';
// The card grid styles: this component owns the dependency so the agent
// Overview renders styled cards even when loaded directly (deep link/refresh).
import '../styles/analytics-overview.css';
import {
  RECOVERED_REQUESTS_TOOLTIP,
  REQUEST_SUCCESS_RATE_TOOLTIP,
  type AutofixStats,
} from '../services/api/analytics.js';

function fmtPct(v: number): string {
  const pct = v * 100;
  return pct === 100 || pct === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function trendBadge(current: number, previous: number) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span class="trend trend--neutral">new</span>;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
  const sign = clamped > 0 ? '+' : '';
  return (
    <span class="trend trend--neutral">
      {sign}
      {clamped}%
    </span>
  );
}

export interface AutofixKpiCardsProps {
  stats: AutofixStats | undefined;
  /** When set, the recovered cards deep-link the Requests log for this harness. */
  agentName?: string;
  /** The page's current window, carried on the deep links. */
  range?: string;
}

const viewEye = (): JSX.Element => (
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
    style="opacity: 0.55; flex-shrink: 0;"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * The reliability story, request-first: Success rate · Self-healed requests %
 * · Self-healed via Auto-fix · Self-healed via Fallback. Self-healed =
 * autofix_saves + fallback_saves over the window total.
 */
const AutofixKpiCards: Component<AutofixKpiCardsProps> = (props) => {
  const navigate = useNavigate();
  const requestsLink = (extra: string) => {
    if (!props.agentName) return null;
    const range = props.range ? `&range=${props.range}` : '';
    return `/messages?agent=${encodeURIComponent(props.agentName)}${range}&status=ok${extra}`;
  };
  const linkProps = (link: string | null, title: string) =>
    link
      ? {
          style: 'cursor: pointer;',
          title,
          onClick: () => navigate(link),
        }
      : {};
  const selfHealed = () => {
    const s = props.stats;
    if (!s) return 0;
    return s.autofix_saves.value + (s.fallback_saves?.value ?? 0);
  };
  const selfHealedPrev = () => {
    const s = props.stats;
    if (!s) return 0;
    return s.autofix_saves.previous + (s.fallback_saves?.previous ?? 0);
  };
  const selfHealedPct = () => {
    const s = props.stats;
    if (!s || !s.total_requests || s.total_requests.value === 0) return 0;
    return selfHealed() / s.total_requests.value;
  };
  const selfHealedPctPrev = () => {
    const s = props.stats;
    if (!s || !s.total_requests || s.total_requests.previous === 0) return 0;
    return selfHealedPrev() / s.total_requests.previous;
  };

  return (
    <Show when={props.stats}>
      {(s) => (
        <div class="overview-stats" style="grid-template-columns: repeat(4, 1fr);">
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">
              Success rate
              <InfoTooltip text={REQUEST_SUCCESS_RATE_TOOLTIP} />
            </span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(s().success_rate.value)}</span>
              {trendBadge(s().success_rate.value, s().success_rate.previous)}
            </div>
          </div>
          <div
            class="overview-stat-card"
            {...linkProps(
              requestsLink('&trigger=autofix,fallback'),
              "View this harness's recovered requests",
            )}
          >
            <span class="overview-stat-card__label">
              Recovered requests
              <InfoTooltip text={RECOVERED_REQUESTS_TOOLTIP} />
              <Show when={requestsLink('')}>{viewEye()}</Show>
            </span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(selfHealedPct())}</span>
              {trendBadge(selfHealedPct(), selfHealedPctPrev())}
            </div>
          </div>
          <div
            class="overview-stat-card"
            {...linkProps(
              requestsLink('&trigger=autofix'),
              'View the successful requests holding an auto-fixed attempt',
            )}
          >
            <span class="overview-stat-card__label">
              Recovered by Auto-fix <Show when={requestsLink('')}>{viewEye()}</Show>
            </span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{formatNumber(s().autofix_saves.value)}</span>
              {trendBadge(s().autofix_saves.value, s().autofix_saves.previous)}
            </div>
          </div>
          <div
            class="overview-stat-card"
            {...linkProps(
              requestsLink('&trigger=fallback'),
              'View the successful requests holding a fallback retry',
            )}
          >
            <span class="overview-stat-card__label">
              Recovered by Fallback <Show when={requestsLink('')}>{viewEye()}</Show>
            </span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">
                {formatNumber(s().fallback_saves?.value ?? 0)}
              </span>
              {trendBadge(s().fallback_saves?.value ?? 0, s().fallback_saves?.previous ?? 0)}
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default AutofixKpiCards;
