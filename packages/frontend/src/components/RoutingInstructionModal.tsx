import { Show, type Component } from "solid-js";
import { CopyButton } from "./SetupStepInstall.jsx";

const ENABLE_CMD = `openclaw config set agents.defaults.model.primary manifest/auto\nopenclaw gateway restart`;
const DISABLE_CMD = `openclaw config set agents.defaults.model.primary <your-model>\nopenclaw gateway restart`;

interface Props {
  open: boolean;
  mode: "enable" | "disable";
  onClose: () => void;
}

const RoutingInstructionModal: Component<Props> = (props) => {
  const isEnable = () => props.mode === "enable";
  const title = () => (isEnable() ? "Activate routing" : "Deactivate routing");
  const command = () => (isEnable() ? ENABLE_CMD : DISABLE_CMD);

  const description = () =>
    isEnable()
      ? "Set manifest/auto as your default model so requests are routed through Manifest:"
      : "Switch back to your preferred model to stop routing through Manifest:";

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
        onKeyDown={(e) => { if (e.key === "Escape") props.onClose(); }}
      >
        <div
          class="modal-card"
          style="max-width: 540px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="routing-instruction-title"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <h2
              id="routing-instruction-title"
              style="margin: 0; font-size: var(--font-size-lg); font-weight: 600;"
            >
              {title()}
            </h2>
            <button class="modal__close" onClick={() => props.onClose()} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
            {description()}
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
              <CopyButton text={command()} />
              <Show when={isEnable()} fallback={
                <>
                  <div>
                    <span class="modal-terminal__prompt">$</span>
                    <span class="modal-terminal__code">openclaw config set agents.defaults.model.primary &lt;your-model&gt;</span>
                  </div>
                  <div style="margin-top: 8px;">
                    <span class="modal-terminal__prompt">$</span>
                    <span class="modal-terminal__code">openclaw gateway restart</span>
                  </div>
                </>
              }>
                <div>
                  <span class="modal-terminal__prompt">$</span>
                  <span class="modal-terminal__code">openclaw config set agents.defaults.model.primary manifest/auto</span>
                </div>
                <div style="margin-top: 8px;">
                  <span class="modal-terminal__prompt">$</span>
                  <span class="modal-terminal__code">openclaw gateway restart</span>
                </div>
              </Show>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn--primary" onClick={() => props.onClose()}>
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default RoutingInstructionModal;
