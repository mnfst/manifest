import { For, Show, type Accessor, type Component } from 'solid-js';
import type {
  AvailableModel,
  ModelCapability,
  ResponseMode,
  TierAssignment,
} from '../services/api.js';
import { STAGES, DEFAULT_STAGE } from '../services/providers.js';
import { t, tp } from '../i18n/index.js';

export interface IncompatibleModel {
  model: string;
  tier: string;
  tierLabel: string;
  position: 'primary' | number;
}

interface Props {
  responseMode: Accessor<ResponseMode>;
  onResponseModeChange: (mode: ResponseMode) => void | Promise<void>;
  disabled?: Accessor<boolean>;
  tiers: TierAssignment[];
  models: AvailableModel[];
  onClose: () => void;
  onReplace?: (
    tierId: string,
    position: 'primary' | number,
    requiredCapability: ModelCapability,
  ) => void;
}

function tierLabel(tierId: string): string {
  const stage = [DEFAULT_STAGE, ...STAGES].find((s) => s.id === tierId);
  if (!stage) return tierId;
  const labels: Record<string, string> = {
    default: t('routing.tier.default'),
    simple: t('routing.tier.simple'),
    standard: t('routing.tier.standard'),
    complex: t('routing.tier.complex'),
    reasoning: t('routing.tier.reasoning'),
  };
  return labels[tierId] ?? stage.label;
}

function positionLabel(position: IncompatibleModel['position']): string {
  return position === 'primary'
    ? t('responseMode.primary')
    : t('responseMode.fallbackPosition', { position: position + 1 });
}

function getIncompatibleModels(
  tiers: TierAssignment[],
  models: AvailableModel[],
): IncompatibleModel[] {
  const caps = new Map<string, readonly ModelCapability[]>();
  for (const m of models) {
    if (m.capabilities) caps.set(m.model_name, m.capabilities);
  }
  const hasStream = (model: string) => caps.get(model)?.includes('stream') ?? false;

  const result: IncompatibleModel[] = [];
  for (const t of tiers) {
    const route = t.override_route;
    if (route && !hasStream(route.model)) {
      result.push({
        model: route.model,
        tier: t.tier,
        tierLabel: tierLabel(t.tier),
        position: 'primary',
      });
    }
    for (const [i, fb] of (t.fallback_routes ?? []).entries()) {
      if (!hasStream(fb.model)) {
        result.push({
          model: fb.model,
          tier: t.tier,
          tierLabel: tierLabel(t.tier),
          position: i,
        });
      }
    }
  }
  return result;
}

const ResponseModeModal: Component<Props> = (props) => {
  const isStream = () => props.responseMode() === 'stream';
  const incompatible = () => getIncompatibleModels(props.tiers, props.models);
  const canEnableStream = () => incompatible().length === 0;

  const handleToggle = () => {
    if (isStream()) {
      void props.onResponseModeChange('buffered');
    } else if (canEnableStream()) {
      void props.onResponseModeChange('stream');
    }
  };

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onClose();
      }}
    >
      <div
        class="modal-card response-mode-modal"
        style="max-width: 520px;"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="routing-modal__header">
          <div class="routing-modal__title">{t('responseMode.title')}</div>
          <button
            class="modal__close"
            onClick={() => props.onClose()}
            aria-label={t('components.close')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div class="response-mode-modal__body">
          <div class="response-mode-modal__field-header">
            <span class="response-mode-modal__field-title">{t('responseMode.streamMode')}</span>
            <button
              class="routing-switch"
              classList={{
                'routing-switch--on': isStream(),
                'routing-switch--disabled': !isStream() && !canEnableStream(),
              }}
              disabled={props.disabled?.() || (!isStream() && !canEnableStream())}
              onClick={handleToggle}
            >
              <span class="routing-switch__track">
                <span class="routing-switch__thumb" />
              </span>
            </button>
          </div>
          <Show
            when={isStream()}
            fallback={
              <p class="response-mode-modal__desc">{t('responseMode.bufferedDescription')}</p>
            }
          >
            <p class="response-mode-modal__desc">{t('responseMode.streamDescription')}</p>
          </Show>

          <Show when={!isStream() && incompatible().length > 0}>
            <div class="response-mode-modal__blocker">
              <p class="response-mode-modal__blocker-text">
                {tp('responseMode.incompatible', incompatible().length)}
              </p>
              <div class="response-mode-modal__blocker-list">
                <For each={incompatible()}>
                  {(item) => (
                    <div class="response-mode-modal__blocker-row">
                      <span class="response-mode-modal__blocker-model">{item.model}</span>
                      <span class="response-mode-modal__blocker-meta">
                        {item.tierLabel} · {positionLabel(item.position)}
                      </span>
                      <button
                        class="btn btn--outline btn--sm"
                        onClick={() => props.onReplace?.(item.tier, item.position, 'stream')}
                      >
                        {t('components.change')}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default ResponseModeModal;
