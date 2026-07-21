import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import { t } from '../i18n/index.js';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

const EyeIcon: Component<{ open: boolean }> = (props) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <Show
      when={props.open}
      fallback={
        <>
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </>
      }
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </Show>
  </svg>
);

const CraftAgentSetup: Component<Props> = (props) => {
  const [keyRevealed, setKeyRevealed] = createSignal(false);

  const hasFullKey = () => !!props.apiKey;
  const masked = () => (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const copyKey = () => props.apiKey ?? masked();
  const visibleKey = () => (keyRevealed() && props.apiKey ? props.apiKey : masked());

  return (
    <div class="setup-agents-card">
      <p class="setup-method__hint">
        {t('craft.beforeProvider')} <code class="setup-model-hint__code">Manifest</code>{' '}
        {t('craft.afterProvider')} <code class="setup-model-hint__code">auto</code>{' '}
        {t('craft.afterModel')}
      </p>

      <div class="setup-cli-block">
        <div class="setup-cli-block__actions">
          <Show when={hasFullKey()}>
            <button
              class="modal-terminal__copy"
              onClick={() => setKeyRevealed(!keyRevealed())}
              aria-label={keyRevealed() ? t('components.hideApiKey') : t('components.revealApiKey')}
              title={keyRevealed() ? t('components.hideKey') : t('components.revealKey')}
            >
              <EyeIcon open={keyRevealed()} />
            </button>
          </Show>
          <CopyButton text={copyKey()} />
        </div>
        <CodeBlock code={visibleKey()} language="text" />
      </div>
    </div>
  );
};

export default CraftAgentSetup;
