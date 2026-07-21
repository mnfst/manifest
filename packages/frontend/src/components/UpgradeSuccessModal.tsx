import { Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '../i18n/index.js';

interface UpgradeSuccessModalProps {
  open: boolean;
  onClose: () => void;
}

const UpgradeSuccessModal: Component<UpgradeSuccessModalProps> = (props) => {
  const features = () => [
    t('plan.pro.unlimitedRequests'),
    t('plan.pro.retention'),
    t('plan.pro.support'),
  ];
  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="modal-backdrop"
          onClick={() => props.onClose()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') props.onClose();
          }}
        >
          <div
            class="modal upgrade-success-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('upgrade.successAria')}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="upgrade-success-modal__body">
              <div class="upgrade-success-modal__icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="#2632EF"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z" />
                </svg>
              </div>
              <h2 class="upgrade-success-modal__title">{t('upgrade.title')}</h2>
              <p class="upgrade-success-modal__subtitle">{t('upgrade.description')}</p>
              <ul class="upgrade-success-modal__features">
                {features().map((f) => (
                  <li>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="#2632EF"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                class="btn btn--primary upgrade-success-modal__done"
                onClick={() => props.onClose()}
              >
                {t('components.done')}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export default UpgradeSuccessModal;
