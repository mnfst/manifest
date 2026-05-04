import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import {
  getClaudeCodeSettingsSnippet,
  getClaudeCodeShellSnippet,
} from '../services/framework-snippets.js';

type SubTab = 'shell' | 'settings';

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

const ClaudeCodeSetup: Component<Props> = (props) => {
  const [subTab, setSubTab] = createSignal<SubTab>('shell');
  const [keyRevealed, setKeyRevealed] = createSignal(false);

  const hasFullKey = () => !!props.apiKey;
  const masked = () => (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const copyKey = () => props.apiKey ?? masked();
  const visibleKey = () => (keyRevealed() && props.apiKey ? props.apiKey : masked());

  const shellCopy = () => getClaudeCodeShellSnippet(props.baseUrl, copyKey());
  const shellShown = () => getClaudeCodeShellSnippet(props.baseUrl, visibleKey());
  const settingsCopy = () => getClaudeCodeSettingsSnippet(props.baseUrl, copyKey());
  const settingsShown = () => getClaudeCodeSettingsSnippet(props.baseUrl, visibleKey());

  return (
    <div class="setup-agents-card">
      <p class="setup-step__desc">
        Point Claude Code at Manifest by setting <code>ANTHROPIC_BASE_URL</code> and{' '}
        <code>ANTHROPIC_AUTH_TOKEN</code>. Manifest tier-routes each request to the cheapest model
        that can handle it.
      </p>

      <div
        class="setup-segment setup-segment--full"
        role="tablist"
        aria-label="Configuration method"
      >
        <button
          class="setup-segment__btn"
          classList={{ 'setup-segment__btn--active': subTab() === 'shell' }}
          onClick={() => setSubTab('shell')}
          role="tab"
          aria-selected={subTab() === 'shell'}
        >
          One-shot
        </button>
        <button
          class="setup-segment__btn"
          classList={{ 'setup-segment__btn--active': subTab() === 'settings' }}
          onClick={() => setSubTab('settings')}
          role="tab"
          aria-selected={subTab() === 'settings'}
        >
          Persist in settings.json
        </button>
      </div>

      <Show when={subTab() === 'shell'}>
        <p class="setup-method__hint">
          Run this in any terminal — sets the env vars for this Claude Code session only.
        </p>
        <div class="setup-cli-block">
          <div class="setup-cli-block__actions">
            <Show when={hasFullKey()}>
              <button
                class="modal-terminal__copy"
                onClick={() => setKeyRevealed(!keyRevealed())}
                aria-label={keyRevealed() ? 'Hide API key' : 'Reveal API key'}
                title={keyRevealed() ? 'Hide key' : 'Reveal key'}
              >
                <EyeIcon open={keyRevealed()} />
              </button>
            </Show>
            <CopyButton text={shellCopy()} />
          </div>
          <CodeBlock code={shellShown()} language="bash" />
        </div>
      </Show>

      <Show when={subTab() === 'settings'}>
        <p class="setup-method__hint">
          Patches <code>~/.claude/settings.json</code> so every future <code>claude</code> run picks
          up the Manifest endpoint. Idempotent — preserves existing settings.
        </p>
        <div class="setup-cli-block">
          <div class="setup-cli-block__actions">
            <Show when={hasFullKey()}>
              <button
                class="modal-terminal__copy"
                onClick={() => setKeyRevealed(!keyRevealed())}
                aria-label={keyRevealed() ? 'Hide API key' : 'Reveal API key'}
                title={keyRevealed() ? 'Hide key' : 'Reveal key'}
              >
                <EyeIcon open={keyRevealed()} />
              </button>
            </Show>
            <CopyButton text={settingsCopy()} />
          </div>
          <CodeBlock code={settingsShown()} language="bash" />
        </div>
      </Show>
    </div>
  );
};

export default ClaudeCodeSetup;
