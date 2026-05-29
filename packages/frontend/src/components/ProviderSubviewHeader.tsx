import { Show, type Component } from 'solid-js';

export type ProviderSubviewLayout = 'modal' | 'page';

interface Props {
  layout?: ProviderSubviewLayout;
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

/** Modal-only chrome above provider detail / form sub-views. */
const ProviderSubviewHeader: Component<Props> = (props) => (
  <Show when={props.layout !== 'page'}>
    <button class="modal-back-btn" onClick={props.onBack} aria-label="Back to providers">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M14.71 7.29a.996.996 0 0 0-1.41 0l-4 4a.996.996 0 0 0 0 1.41l4 4c.2.2.45.29.71.29s.51-.1.71-.29a.996.996 0 0 0 0-1.41L11.43 12l3.29-3.29a.996.996 0 0 0 0-1.41Z" />
      </svg>
    </button>
    <Show when={props.title}>
      <div class="routing-modal__header" style="border: none; padding: 0; margin-bottom: 15px;">
        <div>
          <div class="routing-modal__title">{props.title}</div>
          <Show when={props.subtitle}>
            <div class="routing-modal__subtitle">{props.subtitle}</div>
          </Show>
        </div>
      </div>
    </Show>
  </Show>
);

export default ProviderSubviewHeader;
