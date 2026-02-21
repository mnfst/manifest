import { Show, type Component } from "solid-js";
import { CopyButton } from "./SetupStepInstall.jsx";

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  endpoint: string | null;
}

const SetupStepLocalConfigure: Component<Props> = (props) => {
  const key = () => props.apiKey ?? "mnfst_YOUR_KEY";

  const cliCommand = () => {
    const lines = [
      `openclaw config set plugins.entries.manifest.config.mode "local"`,
      `openclaw config set plugins.entries.manifest.config.apiKey "${key()}"`,
    ];
    if (props.endpoint) {
      lines.push(`openclaw config set plugins.entries.manifest.config.endpoint "${props.endpoint}"`);
    }
    return lines.join("\n");
  };

  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        Configure for local mode
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Set your plugin to local mode so it connects to this server.
      </p>

      <Show when={!!props.apiKey}>
        <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 12px; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
          Copy your API key now — it won't be shown again.
        </div>
        <div style="display: flex; align-items: center; gap: 8px; background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 16px; font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all;">
          {props.apiKey}
          <CopyButton text={props.apiKey!} />
        </div>
      </Show>

      <Show when={!props.apiKey && props.keyPrefix}>
        <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); font-family: var(--font-mono); padding: 10px 14px; background: hsl(var(--muted)); border-radius: var(--radius); margin-bottom: 16px;">
          Active key: {props.keyPrefix}...
        </div>
      </Show>

      <div class="modal-terminal">
        <div class="modal-terminal__header">
          <div class="modal-terminal__dots">
            <span class="modal-terminal__dot modal-terminal__dot--red" />
            <span class="modal-terminal__dot modal-terminal__dot--yellow" />
            <span class="modal-terminal__dot modal-terminal__dot--green" />
          </div>
          <div class="modal-terminal__tabs">
            <span class="modal-terminal__tab modal-terminal__tab--active">OpenClaw CLI</span>
          </div>
        </div>
        <div class="modal-terminal__body">
          <CopyButton text={cliCommand()} />
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
            <code class="modal-terminal__code">{cliCommand()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SetupStepLocalConfigure;
