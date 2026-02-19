import { type Component } from "solid-js";
import { CopyButton } from "./SetupStepInstall.jsx";

const RESTART_CMD = "openclaw gateway restart";

const SetupStepVerify: Component<{ stepNumber?: number }> = (props) => {
  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        {props.stepNumber ? `${props.stepNumber}. ` : ''}Activate the plugin
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Restart OpenClaw to activate the plugin:
      </p>

      <div class="modal-terminal">
        <div class="modal-terminal__header">
          <div class="modal-terminal__dots">
            <span class="modal-terminal__dot modal-terminal__dot--red" />
            <span class="modal-terminal__dot modal-terminal__dot--yellow" />
            <span class="modal-terminal__dot modal-terminal__dot--green" />
          </div>
          <div class="modal-terminal__tabs">
            <span class="modal-terminal__tab modal-terminal__tab--active">Terminal</span>
          </div>
        </div>
        <div class="modal-terminal__body">
          <CopyButton text={RESTART_CMD} />
          <div class="modal-terminal__line modal-terminal__line--comment"># Restart OpenClaw to activate the plugin</div>
          <div>
            <span class="modal-terminal__prompt">$</span>
            <span class="modal-terminal__code">{RESTART_CMD}</span>
          </div>
        </div>
      </div>

      <p style="margin: 16px 0 0; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Once restarted, send a message to your agent. Activity will appear on the dashboard a few seconds after the agent responds.
      </p>
    </div>
  );
};

export default SetupStepVerify;
