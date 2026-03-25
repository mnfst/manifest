import { createSignal, Show, type Component } from 'solid-js';
import { CopyButton } from './SetupStepInstall.jsx';

type ConfigTab = 'sdk' | 'curl';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

const SetupStepAddProvider: Component<Props> = (props) => {
  const [tab, setTab] = createSignal<ConfigTab>('sdk');

  const hasFullKey = () => !!props.apiKey;
  const displayKey = () =>
    props.apiKey ?? (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');

  const sdkSnippet = () =>
    `from openai import OpenAI

client = OpenAI(
    base_url="${props.baseUrl}",
    api_key="${displayKey()}",
)

response = client.chat.completions.create(
    model="manifest/auto",
    messages=[{"role": "user", "content": "Hello"}],
)`;

  const curlSnippet = () =>
    `curl ${props.baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${displayKey()}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "manifest/auto",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;

  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        Add Manifest as a provider
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Use any OpenAI-compatible client. Set the base URL and API key below, then use{' '}
        <code style="font-family: var(--font-mono); font-size: var(--font-size-sm); background: hsl(var(--muted)); padding: 2px 6px; border-radius: 4px;">
          manifest/auto
        </code>{' '}
        as your model.
      </p>

      <Show when={hasFullKey()}>
        <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 12px; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
          Copy your API key now -- it will not be shown again.
        </div>
        <div style="display: flex; align-items: center; gap: 8px; background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 16px; font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all;">
          {props.apiKey}
          <CopyButton text={props.apiKey!} />
        </div>
      </Show>

      <Show when={!hasFullKey() && props.keyPrefix}>
        <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); padding: 10px 14px; background: hsl(var(--muted)); border-radius: var(--radius); margin-bottom: 16px;">
          Replace{' '}
          <code style="font-family: var(--font-mono); font-size: var(--font-size-sm);">
            {props.keyPrefix}...
          </code>{' '}
          below with your full API key.
        </div>
      </Show>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; font-size: var(--font-size-sm);">
        <div style="background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px;">
          <div style="color: hsl(var(--muted-foreground)); margin-bottom: 4px;">Base URL</div>
          <div style="font-family: var(--font-mono); font-size: var(--font-size-xs); word-break: break-all; display: flex; align-items: center; gap: 6px;">
            <span>{props.baseUrl}</span>
            <CopyButton text={props.baseUrl} />
          </div>
        </div>
        <div style="background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px;">
          <div style="color: hsl(var(--muted-foreground)); margin-bottom: 4px;">Model</div>
          <div style="font-family: var(--font-mono); font-size: var(--font-size-xs); display: flex; align-items: center; gap: 6px;">
            <span>manifest/auto</span>
            <CopyButton text="manifest/auto" />
          </div>
        </div>
      </div>

      <div class="modal-terminal">
        <div class="modal-terminal__header">
          <div class="modal-terminal__dots">
            <span class="modal-terminal__dot modal-terminal__dot--red" />
            <span class="modal-terminal__dot modal-terminal__dot--yellow" />
            <span class="modal-terminal__dot modal-terminal__dot--green" />
          </div>
          <div class="modal-terminal__tabs" role="tablist" aria-label="Code example">
            <button
              class="modal-terminal__tab"
              classList={{ 'modal-terminal__tab--active': tab() === 'sdk' }}
              onClick={() => setTab('sdk')}
              role="tab"
              aria-selected={tab() === 'sdk'}
            >
              Python SDK
            </button>
            <span class="modal-terminal__tab-sep" aria-hidden="true">
              |
            </span>
            <button
              class="modal-terminal__tab"
              classList={{ 'modal-terminal__tab--active': tab() === 'curl' }}
              onClick={() => setTab('curl')}
              role="tab"
              aria-selected={tab() === 'curl'}
            >
              cURL
            </button>
          </div>
        </div>
        <div class="modal-terminal__body">
          <CopyButton text={tab() === 'sdk' ? sdkSnippet() : curlSnippet()} />
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
            <code class="modal-terminal__code">
              {tab() === 'sdk' ? sdkSnippet() : curlSnippet()}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SetupStepAddProvider;
