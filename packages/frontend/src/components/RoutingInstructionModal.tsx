import { Show, createSignal, type Component } from "solid-js";
import { CopyButton } from "./SetupStepInstall.jsx";
import ModelSelectDropdown from "./ModelSelectDropdown.jsx";

const ENABLE_CMD = `openclaw config set agents.defaults.model.primary manifest/auto\nopenclaw gateway restart`;

interface Props {
  open: boolean;
  mode: "enable" | "disable";
  onClose: () => void;
}

const RoutingInstructionModal: Component<Props> = (props) => {
  const [selectedModel, setSelectedModel] = createSignal<string | null>(null);
  const [selectedLabel, setSelectedLabel] = createSignal<string | null>(null);
  const isEnable = () => props.mode === "enable";
  const title = () => (isEnable() ? "Activate routing" : "Deactivate routing");
  const modelOrPlaceholder = () => selectedModel() ?? "<provider/model>";
  const disableCmd = () =>
    `openclaw config set agents.defaults.model.primary ${modelOrPlaceholder()}\nopenclaw gateway restart`;
  const command = () => (isEnable() ? ENABLE_CMD : disableCmd());

  const handleModelSelect = (cliValue: string, displayLabel: string) => {
    setSelectedModel(cliValue);
    setSelectedLabel(displayLabel);
  };

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

          <Show when={isEnable()}>
            <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              Run the following command in your agent's terminal to route all requests through Manifest:
            </p>
          </Show>

          <Show when={!isEnable()}>
            <p style="margin: 0 0 14px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              This will stop routing requests through Manifest and restore direct model access in your OpenClaw agent.
            </p>

            <p style="margin: 0 0 8px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              1. Pick the model your agent should use directly:
            </p>

            <ModelSelectDropdown
              selectedValue={selectedModel()}
              onSelect={handleModelSelect}
            />

            <p style="margin: 14px 0; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              2. Run this command in your agent's terminal to restore direct model access:
            </p>
          </Show>

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
                    <span class="modal-terminal__code">openclaw config set agents.defaults.model.primary {modelOrPlaceholder()}</span>
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
