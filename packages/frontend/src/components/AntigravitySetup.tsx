import type { Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

const ConfigField: Component<{
  label: string;
  value: string;
  copyValue?: string;
}> = (props) => (
  <div class="setup-onboard-fields__row" role="listitem">
    <span class="setup-onboard-fields__label">{props.label}</span>
    <span class="setup-onboard-fields__value">
      <code>{props.value}</code>
      <Show when={props.copyValue}>
        <CopyButton text={props.copyValue!} />
      </Show>
    </span>
  </div>
);

const AntigravitySetup: Component<Props> = (props) => (
  <div class="setup-agents-card">
    <p class="setup-method__hint">
      Antigravity's current Models settings are for built-in model and quota selection. It does not
      expose a custom OpenAI-compatible provider setting, so Manifest cannot be connected to
      Antigravity directly yet.
    </p>
    <p class="setup-method__hint">
      Use OpenCode, Claude Code, or a toolkit integration to route through Manifest today. These
      endpoint values are here for reference if Antigravity adds custom model endpoints later.
    </p>

    <div class="setup-onboard-fields" role="list" aria-label="Reference endpoint values">
      <ConfigField label="Base URL" value={props.baseUrl} copyValue={props.baseUrl} />
      <ConfigField label="Model ID" value="auto" copyValue="auto" />
      <ConfigField label="Model name" value="manifest/auto" copyValue="manifest/auto" />
    </div>
  </div>
);

export default AntigravitySetup;
