import { createSignal, Show, type Component } from "solid-js";
import { CopyButton } from "./SetupStepInstall.jsx";

type ConfigTab = "cli" | "env";

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  agentName: string;
  endpoint: string | null;
  stepNumber?: number;
}

const SetupStepConfigure: Component<Props> = (props) => {
  const [tab, setTab] = createSignal<ConfigTab>("cli");

  const hasFullKey = () => !!props.apiKey;
  const displayKey = () => props.apiKey ?? (props.keyPrefix ? `${props.keyPrefix}...` : "mnfst_YOUR_KEY");

  const cliCommand = () => {
    const lines = [`openclaw config set plugins.entries.manifest.config.apiKey "${displayKey()}"`];
    if (props.endpoint) {
      lines.push(`openclaw config set plugins.entries.manifest.config.endpoint "${props.endpoint}"`);
    }
    return lines.join("\n");
  };

  const envCommand = () => {
    const lines = [`export MANIFEST_API_KEY="${displayKey()}"`];
    if (props.endpoint) {
      lines.push(`export MANIFEST_ENDPOINT="${props.endpoint}"`);
    }
    return lines.join("\n");
  };

  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        {props.stepNumber ? `${props.stepNumber}. ` : ''}Configure your agent
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Run one of these commands to connect your agent to Manifest.
      </p>

      <Show when={hasFullKey()}>
        <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 12px; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
          Copy your API key now — it won't be shown again.
        </div>
        <div style="display: flex; align-items: center; gap: 8px; background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 16px; font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all;">
          {props.apiKey}
          <CopyButton text={props.apiKey!} />
        </div>
      </Show>

      <Show when={!hasFullKey() && props.keyPrefix}>
        <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); padding: 10px 14px; background: hsl(var(--muted)); border-radius: var(--radius); margin-bottom: 16px;">
          Replace <code style="font-family: var(--font-mono); font-size: var(--font-size-sm);">{props.keyPrefix}...</code> below with your full API key.
        </div>
      </Show>

      <div class="modal-terminal">
        <div class="modal-terminal__header">
          <div class="modal-terminal__dots">
            <span class="modal-terminal__dot modal-terminal__dot--red" />
            <span class="modal-terminal__dot modal-terminal__dot--yellow" />
            <span class="modal-terminal__dot modal-terminal__dot--green" />
          </div>
          <div class="modal-terminal__tabs" role="tablist" aria-label="Configuration method">
            <button
              class="modal-terminal__tab"
              classList={{ "modal-terminal__tab--active": tab() === "cli" }}
              onClick={() => setTab("cli")}
              role="tab"
              aria-selected={tab() === "cli"}
            >
              OpenClaw CLI
            </button>
            <span class="modal-terminal__tab-sep" aria-hidden="true">|</span>
            <button
              class="modal-terminal__tab"
              classList={{ "modal-terminal__tab--active": tab() === "env" }}
              onClick={() => setTab("env")}
              role="tab"
              aria-selected={tab() === "env"}
            >
              Environment
            </button>
          </div>
        </div>
        <div class="modal-terminal__body">
          <CopyButton text={tab() === "cli" ? cliCommand() : envCommand()} />
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
            <code class="modal-terminal__code">
              {tab() === "cli" ? cliCommand() : envCommand()}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SetupStepConfigure;
