import { createSignal, createEffect, Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '../i18n/index.js';

export interface LimitRuleData {
  metric_type: string;
  threshold: number;
  period: string;
  action: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: LimitRuleData) => Promise<void> | void;
  editData?: LimitRuleData | null;
  hasProvider?: boolean;
}

const LimitRuleModal: Component<Props> = (props) => {
  const [blockEnabled, setBlockEnabled] = createSignal(false);
  const [metricType, setMetricType] = createSignal<string>('tokens');
  const [threshold, setThreshold] = createSignal<string>('');
  const [period, setPeriod] = createSignal<string>('day');

  const actionValue = () => (blockEnabled() ? 'both' : 'notify');

  const reset = () => {
    setBlockEnabled(false);
    setMetricType('tokens');
    setThreshold('');
    setPeriod('day');
  };

  createEffect(() => {
    if (props.open && props.editData) {
      const d = props.editData;
      setMetricType(d.metric_type);
      setThreshold(String(d.threshold));
      setPeriod(d.period);
      setBlockEnabled(d.action === 'block' || d.action === 'both');
    } else if (props.open) {
      reset();
    }
  });

  const [saving, setSaving] = createSignal(false);

  const handleSave = async () => {
    if (saving()) return;
    const val = Number(threshold());
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      await props.onSave({
        metric_type: metricType(),
        threshold: val,
        period: period(),
        action: actionValue(),
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    props.onClose();
  };

  const isEdit = () => !!props.editData;

  return (
    <Portal>
      <Show when={props.open}>
        <div class="modal-overlay" onClick={() => handleClose()}>
          <div
            class="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="limit-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)
              ) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === 'Escape') handleClose();
            }}
          >
            <h2 class="modal-card__title" id="limit-modal-title">
              {isEdit() ? t('limit.editRule') : t('limit.createRule')}
            </h2>
            <p class="modal-card__desc">{t('limit.alertDescription')}</p>

            <label class="modal-card__field-label" for="limit-metric-select" style="margin-top: 0;">
              {t('limit.metric')}
            </label>
            <select
              id="limit-metric-select"
              class="select notification-modal__select"
              value={metricType()}
              onChange={(e) => setMetricType(e.currentTarget.value)}
              ref={(el) => requestAnimationFrame(() => el.focus())}
            >
              <option value="tokens">{t('costByModel.tokens')}</option>
              <option value="cost">{t('limit.costUsd')}</option>
            </select>

            <div class="limit-modal__row">
              <div class="limit-modal__col">
                <label class="modal-card__field-label" for="limit-threshold-input">
                  {t('limit.threshold')}
                </label>
                <input
                  id="limit-threshold-input"
                  class="modal-card__input"
                  type="number"
                  min="0"
                  step={metricType() === 'cost' ? '0.01' : '1'}
                  placeholder={
                    metricType() === 'cost'
                      ? t('limit.thresholdCostPlaceholder')
                      : t('limit.thresholdTokensPlaceholder')
                  }
                  value={threshold()}
                  onInput={(e) => setThreshold(e.currentTarget.value)}
                />
              </div>
              <div class="limit-modal__col">
                <label class="modal-card__field-label" for="limit-period-select">
                  {t('limit.period')}
                </label>
                <select
                  id="limit-period-select"
                  class="select notification-modal__select"
                  value={period()}
                  onChange={(e) => setPeriod(e.currentTarget.value)}
                >
                  <option value="hour">{t('limit.perHour')}</option>
                  <option value="day">{t('limit.perDay')}</option>
                  <option value="week">{t('limit.perWeek')}</option>
                  <option value="month">{t('limit.perMonth')}</option>
                </select>
              </div>
            </div>

            <div class="limit-block-toggle">
              <span class="limit-block-toggle__label">{t('limit.blockExceeded')}</span>
              <label class="notification-toggle">
                <input
                  type="checkbox"
                  checked={blockEnabled()}
                  onChange={(e) => setBlockEnabled(e.currentTarget.checked)}
                />
                <span class="notification-toggle__slider" />
              </label>
            </div>

            <div class="modal-card__footer">
              <button
                class="btn btn--primary btn--sm"
                disabled={!threshold() || Number(threshold()) <= 0 || saving()}
                onClick={handleSave}
              >
                {saving() ? (
                  <span class="spinner" />
                ) : isEdit() ? (
                  t('limit.saveChanges')
                ) : (
                  t('limit.createRule')
                )}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Portal>
  );
};

export default LimitRuleModal;
