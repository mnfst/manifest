import { createEffect, createSignal, For, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import { highlight } from '../services/syntax-highlight.js';
import {
  type ToolkitId,
  type OpenAILangId,
  TOOLKIT_TABS,
  SDK_LANG_TOGGLE,
  getStoredToolkit,
  storeToolkit,
  getStoredOpenAILang,
  storeOpenAILang,
  getSnippetForToolkit,
  getLangForToolkit,
} from '../services/framework-snippets.js';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
  hideFullKey?: boolean;
  defaultToolkit?: ToolkitId;
  /**
   * Extra request headers to weave into every snippet (OpenAI's defaultHeaders,
   * Vercel AI's headers, LangChain's configuration.defaultHeaders, curl -H).
   * Used by the header-tier "How to send this" modal.
   */
  customHeaders?: Record<string, string>;
}

const EyeOpen: Component = () => (
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
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosed: Component = () => (
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
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </svg>
);

const FrameworkSnippets: Component<Props> = (props) => {
  const [activeTab, setActiveTab] = createSignal<ToolkitId>(
    props.defaultToolkit ?? getStoredToolkit(),
  );
  const [openaiLang, setOpenaiLang] = createSignal<OpenAILangId>(getStoredOpenAILang());
  const [keyRevealed, setKeyRevealed] = createSignal(!props.hideFullKey);

  createEffect(() => {
    if (props.defaultToolkit) setActiveTab(props.defaultToolkit);
  });

  const hasFullKey = () => !!props.apiKey;
  const maskedKey = () => (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const copyKey = () => props.apiKey ?? maskedKey();
  const displayKey = () => {
    if (!hasFullKey()) return maskedKey();
    return keyRevealed() ? props.apiKey! : maskedKey();
  };

  const handleTabChange = (id: ToolkitId) => {
    setActiveTab(id);
    storeToolkit(id);
  };

  const handleLangChange = (id: OpenAILangId) => {
    setOpenaiLang(id);
    storeOpenAILang(id);
  };

  const snippet = () =>
    getSnippetForToolkit(
      activeTab(),
      props.baseUrl,
      displayKey(),
      openaiLang(),
      props.customHeaders,
    );
  const snippetForCopy = () =>
    getSnippetForToolkit(activeTab(), props.baseUrl, copyKey(), openaiLang(), props.customHeaders);
  const language = () => getLangForToolkit(activeTab(), openaiLang());

  const headerEntries = (): [string, string][] =>
    props.customHeaders ? Object.entries(props.customHeaders) : [];

  return (
    <div class="framework-snippets">
      <div class="setup-method-tabs">
        <Show when={!props.defaultToolkit}>
          <div class="panel__tabs" role="tablist" aria-label="SDK / toolkit">
            <For each={TOOLKIT_TABS}>
              {(t) => (
                <button
                  class="panel__tab"
                  classList={{ 'panel__tab--active': activeTab() === t.id }}
                  onClick={() => handleTabChange(t.id)}
                  role="tab"
                  aria-selected={activeTab() === t.id}
                >
                  <Show when={t.icon}>
                    <img src={t.icon} alt="" class="panel__tab-icon" width="16" height="16" />
                  </Show>
                  {t.label}
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={activeTab() === 'openai-sdk' || activeTab() === 'vercel-ai-sdk'}>
          <div class="toolkit-lang-toggle" role="tablist" aria-label="Language">
            <For each={SDK_LANG_TOGGLE}>
              {(lang) => (
                <button
                  class="toolkit-lang-toggle__btn"
                  classList={{ 'toolkit-lang-toggle__btn--active': openaiLang() === lang.id }}
                  onClick={() => handleLangChange(lang.id)}
                  role="tab"
                  aria-selected={openaiLang() === lang.id}
                >
                  <img src={lang.icon} alt="" width="14" height="14" />
                  {lang.label}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="setup-method-tabs__content">
          <div class="setup-cli-block">
            <div class="setup-cli-block__actions">
              <Show when={hasFullKey()}>
                <button
                  class="modal-terminal__copy"
                  onClick={() => setKeyRevealed(!keyRevealed())}
                  aria-label={keyRevealed() ? 'Hide API key in code' : 'Reveal API key in code'}
                  title={keyRevealed() ? 'Hide key' : 'Reveal key'}
                >
                  {keyRevealed() ? <EyeClosed /> : <EyeOpen />}
                </button>
              </Show>
              <CopyButton text={snippetForCopy().code} />
            </div>
            <div class="setup-method__code">
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                <code
                  class={`hljs language-${language()}`}
                  innerHTML={highlight(snippet().code, language())}
                />
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div class="setup-onboard-fields" role="list" aria-label="Connection details">
        <div class="setup-onboard-fields__row" role="listitem">
          <span class="setup-onboard-fields__label">Base URL</span>
          <span class="setup-onboard-fields__value">
            <code>{props.baseUrl}</code>
            <CopyButton text={props.baseUrl} />
          </span>
        </div>
        <div class="setup-onboard-fields__row" role="listitem">
          <span class="setup-onboard-fields__label">API Key</span>
          <span class="setup-onboard-fields__value">
            <code>{displayKey()}</code>
            <Show when={hasFullKey()}>
              <button
                class="setup-onboard-fields__eye"
                onClick={() => setKeyRevealed(!keyRevealed())}
                aria-label={keyRevealed() ? 'Hide API key' : 'Reveal API key'}
                title={keyRevealed() ? 'Hide key' : 'Reveal key'}
              >
                {keyRevealed() ? <EyeClosed /> : <EyeOpen />}
              </button>
            </Show>
            <CopyButton text={copyKey()} />
          </span>
        </div>
        <div class="setup-onboard-fields__row" role="listitem">
          <span class="setup-onboard-fields__label">Model</span>
          <span class="setup-onboard-fields__value">
            <code>auto</code>
            <CopyButton text="auto" />
          </span>
        </div>
        <For each={headerEntries()}>
          {([key, value]) => (
            <div class="setup-onboard-fields__row" role="listitem">
              <span class="setup-onboard-fields__label">
                Header <code>{key}</code>
              </span>
              <span class="setup-onboard-fields__value">
                <code>{value}</code>
                <CopyButton text={value} />
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default FrameworkSnippets;
