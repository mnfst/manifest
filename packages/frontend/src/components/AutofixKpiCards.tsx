import { Show, type Component, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import InfoTooltip from './InfoTooltip.jsx';
import { formatNumber, formatTrend } from '../services/formatters.js';
import { formatNumber as formatLocalizedNumber, t, type TextMessageKey } from '../i18n/index.js';
// The card grid styles: this component owns the dependency so the agent
// Overview renders styled cards even when loaded directly (deep link/refresh).
import '../styles/analytics-overview.css';
import type { AutofixStats } from '../services/api/analytics.js';

function fmtPct(v: number): string {
  const whole = v === 0 || v === 1;
  return formatLocalizedNumber(v, {
    style: 'percent',
    minimumFractionDigits: whole ? 0 : 1,
    maximumFractionDigits: whole ? 0 : 1,
  });
}

function trendBadge(current: number, previous: number) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span class="trend trend--neutral">{t('autofixKpi.trend.new')}</span>;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
  return <span class="trend trend--neutral">{formatTrend(clamped)}</span>;
}

export interface AutofixKpiCardsProps {
  stats: AutofixStats | undefined;
  /** Scopes the deep links to one harness; omitted, they cover every harness. */
  agentName?: string;
  /** The page's current window, carried on the deep links. */
  range?: string;
  /** Hide the deep links entirely (no Requests log to point at). */
  noLinks?: boolean;
}

const viewMore = (): JSX.Element => <span class="view-more-link">{t('autofixKpi.viewMore')}</span>;

type SubjectKey = Extract<TextMessageKey, `autofixKpi.subject.${string}`>;

/**
 * The reliability story, request-first: Success rate · Self-healed requests %
 * · Self-healed via Auto-fix · Self-healed via Fallback. Self-healed =
 * autofix_saves + fallback_saves over the window total.
 */
const AutofixKpiCards: Component<AutofixKpiCardsProps> = (props) => {
  const navigate = useNavigate();
  const requestsLink = (extra: string) => {
    if (props.noLinks) return null;
    const params = [
      props.agentName ? `agent=${encodeURIComponent(props.agentName)}` : '',
      props.range ? `range=${props.range}` : '',
      extra.replace(/^&/, ''),
    ]
      .filter(Boolean)
      .join('&');
    return params ? `/messages?${params}` : '/messages';
  };
  const linkProps = (link: string | null) =>
    link
      ? {
          style: 'cursor: pointer;',
          role: 'link' as const,
          tabIndex: 0,
          onClick: (event: MouseEvent) => {
            const interactive =
              event.target instanceof Element &&
              event.target.closest('a, button, input, select, textarea, [role="button"]');
            if (!interactive) navigate(link);
          },
          onKeyDown: (event: KeyboardEvent) => {
            if (event.target === event.currentTarget && event.key === 'Enter') navigate(link);
          },
        }
      : {};
  const scopeTitle = (subjectKey: SubjectKey) =>
    t(props.agentName ? 'autofixKpi.scope.agent' : 'autofixKpi.scope.all', {
      subject: t(subjectKey),
    });
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
        <div class="overview-stats" style="grid-template-columns: repeat(5, 1fr);">
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">
              {t('autofixKpi.successRate')}
              <InfoTooltip text={t('autofixKpi.successRateHelp')} />
            </span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(s().success_rate.value)}</span>
              {trendBadge(s().success_rate.value, s().success_rate.previous)}
            </div>
          </div>
          <div
            class="overview-stat-card"
            {...linkProps(requestsLink('&status=ok&trigger=autofix,fallback'))}
            title={
              requestsLink('&status=ok&trigger=autofix,fallback')
                ? scopeTitle('autofixKpi.subject.recovered')
                : undefined
            }
          >
            <span class="overview-stat-card__label">
              {t('autofixKpi.recoveredRequests')}
              <InfoTooltip text={t('autofixKpi.recoveredRequestsHelp')} />
            </span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(selfHealedPct())}</span>
              {trendBadge(selfHealedPct(), selfHealedPctPrev())}
              <Show when={requestsLink('')}>{viewMore()}</Show>
            </div>
          </div>
          <div
            class="overview-stat-card overview-stat-card--autofix"
            {...linkProps(requestsLink('&status=ok&trigger=autofix'))}
            title={
              requestsLink('&status=ok&trigger=autofix')
                ? scopeTitle('autofixKpi.subject.autofix')
                : undefined
            }
          >
            <span class="overview-stat-card__label">{t('autofixKpi.recoveredByAutofix')}</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{formatNumber(s().autofix_saves.value)}</span>
              {trendBadge(s().autofix_saves.value, s().autofix_saves.previous)}
              <Show when={requestsLink('')}>{viewMore()}</Show>
            </div>
          </div>
          <div
            class="overview-stat-card overview-stat-card--fallback"
            {...linkProps(requestsLink('&status=ok&trigger=fallback'))}
            title={
              requestsLink('&status=ok&trigger=fallback')
                ? scopeTitle('autofixKpi.subject.fallback')
                : undefined
            }
          >
            <span class="overview-stat-card__label">{t('autofixKpi.recoveredByFallback')}</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">
                {formatNumber(s().fallback_saves?.value ?? 0)}
              </span>
              {trendBadge(s().fallback_saves?.value ?? 0, s().fallback_saves?.previous ?? 0)}
              <Show when={requestsLink('')}>{viewMore()}</Show>
            </div>
          </div>
          <div
            class="overview-stat-card overview-stat-card--destructive"
            {...linkProps(requestsLink('&status=failed'))}
            title={
              requestsLink('&status=failed') ? scopeTitle('autofixKpi.subject.failed') : undefined
            }
          >
            <span class="overview-stat-card__label">{t('autofixKpi.failedRequests')}</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">
                {formatNumber(s().errors_remaining.value)}
              </span>
              {trendBadge(s().errors_remaining.value, s().errors_remaining.previous)}
              <Show when={requestsLink('')}>{viewMore()}</Show>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default AutofixKpiCards;
