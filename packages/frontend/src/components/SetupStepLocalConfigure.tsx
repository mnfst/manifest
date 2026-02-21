import { Show, type Component } from "solid-js";
import { CopyButton } from "./SetupStepInstall.jsx";

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  endpoint: string | null;
}

const SetupStepLocalConfigure: Component<Props> = (props) => {
  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        Your agent is ready
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Your local server is running and your agent is pre-configured. Telemetry will flow automatically when you use your agent.
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

      <div style="background: hsl(var(--muted)); border-radius: var(--radius); padding: 14px; font-size: var(--font-size-sm); line-height: 1.6;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--chart-4))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span>Plugin installed and configured</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--chart-4))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span>API key auto-generated</span>
        </div>
        <Show when={props.endpoint}>
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--chart-4))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Endpoint: <code style="font-family: var(--font-mono); font-size: var(--font-size-xs);">{props.endpoint}</code></span>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default SetupStepLocalConfigure;
