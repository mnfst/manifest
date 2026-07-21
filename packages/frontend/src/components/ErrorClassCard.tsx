import { createResource, For, Show, type Component } from 'solid-js';
import { formatErrorClass, formatNumber } from '../services/formatters.js';
import { messagePing } from '../services/sse.js';
import { getErrorBreakdown } from '../services/api/analytics.js';
import { t } from '../i18n/index.js';

function label(key: string): string {
  const display = formatErrorClass(key) ?? key.replace(/_/g, ' ');
  return display.replace(/^\p{L}/u, (c) => c.toLocaleUpperCase());
}

export interface ErrorClassCardProps {
  range: string;
  agentName?: string;
}

const ErrorClassCard: Component<ErrorClassCardProps> = (props) => {
  const [data] = createResource(
    () => ({ range: props.range, agent: props.agentName, _ping: messagePing() }),
    (p) => getErrorBreakdown(p.range, p.agent),
  );

  const sorted = () => {
    const d = data();
    if (!d) return [];
    return Object.entries(d.by_class)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);
  };

  const maxCount = () => {
    const s = sorted();
    return s.length > 0 ? s[0]![1] : 1;
  };

  return (
    <div class="error-class-card">
      <div class="error-class-card__title">{t('errorClass.title')}</div>
      <Show
        when={sorted().length > 0}
        fallback={<p class="error-class-card__empty">{t('errorClass.empty')}</p>}
      >
        <div class="error-class-card__list">
          <For each={sorted()}>
            {([key, count]) => (
              <div class="error-class-card__row">
                <span class="error-class-card__label">{label(key)}</span>
                <div class="error-class-card__bar-wrap">
                  <div
                    class="error-class-card__bar"
                    style={{ width: `${(count / maxCount()) * 100}%` }}
                  />
                </div>
                <span class="error-class-card__count">{formatNumber(count)}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ErrorClassCard;
