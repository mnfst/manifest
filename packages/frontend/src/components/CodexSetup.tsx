import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

// Codex CLI speaks the OpenAI Responses API (`wire_api = "responses"`), which
// Manifest serves at `<baseUrl>/responses`. `baseUrl` already ends in `/v1`,
// so Codex's `{base_url}/responses` lands on Manifest's `/v1/responses` route.
//
// Manifest is wired as a named profile, NOT the top-level `model` /
// `model_provider`. Setting those globally hijacks every Codex session (and
// breaks the home screen if the env var is missing); a profile keeps Manifest
// opt-in via `codex --profile manifest` and leaves the user's default intact.
function getCodexConfig(baseUrl: string): string {
  return `[model_providers.manifest]
name = "Manifest"
base_url = "${baseUrl}"
env_key = "MANIFEST_API_KEY"
wire_api = "responses"

[profiles.manifest]
model = "auto"
model_provider = "manifest"`;
}

// The command that runs Codex against Manifest via the profile above.
function getCodexRunCommand(): string {
  return `codex --profile manifest`;
}

// Codex reads the key from the env var named by `env_key` and sends it as a
// Bearer token — there is no inline key field in config.toml, so the key lives
// in the shell environment.
function getCodexKeyExport(apiKey: string): string {
  return `export MANIFEST_API_KEY="${apiKey}"`;
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

const CodexSetup: Component<Props> = (props) => {
  const [keyRevealed, setKeyRevealed] = createSignal(false);

  const placeholderKey = 'mnfst_YOUR_KEY';
  const hasFullKey = () => !!props.apiKey;
  const masked = () => (props.keyPrefix ? `${props.keyPrefix}...` : placeholderKey);
  const copyKey = () => props.apiKey ?? placeholderKey;
  const visibleKey = () => {
    if (!props.apiKey) return placeholderKey;
    return keyRevealed() ? props.apiKey : masked();
  };

  const config = () => getCodexConfig(props.baseUrl);
  const keyExportCopy = () => getCodexKeyExport(copyKey());
  const keyExportShown = () => getCodexKeyExport(visibleKey());
  const runCommand = () => getCodexRunCommand();

  return (
    <div class="setup-agents-card">
      <p class="setup-method__hint">
        Add this block to your global{' '}
        <code class="setup-model-hint__code">~/.codex/config.toml</code>. It adds Manifest as a
        profile, so your default Codex setup stays untouched.
      </p>

      <div class="setup-cli-block">
        <div class="setup-cli-block__actions">
          <CopyButton text={config()} />
        </div>
        <CodeBlock code={config()} language="toml" />
      </div>

      <p class="setup-method__hint">Then export your Manifest key so Codex can authenticate:</p>

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
          <CopyButton text={keyExportCopy()} />
        </div>
        <CodeBlock code={keyExportShown()} language="bash" />
      </div>

      <p class="setup-method__hint">Then run Codex against Manifest with the profile:</p>

      <div class="setup-cli-block">
        <div class="setup-cli-block__actions">
          <CopyButton text={runCommand()} />
        </div>
        <CodeBlock code={runCommand()} language="bash" />
      </div>
    </div>
  );
};

export default CodexSetup;
