import { createSignal, type Component } from "solid-js";

function CopyButton(props: { text: string }) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy (e.g. non-HTTPS contexts)
    }
  };

  return (
    <button class="modal-terminal__copy" onClick={handleCopy} title="Copy" aria-label={copied() ? "Copied" : "Copy to clipboard"}>
      {copied() ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

const INSTALL_CMD = "openclaw plugins install manifest";

const SetupStepInstall: Component<{ stepNumber?: number }> = (props) => {
  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        {props.stepNumber ? `${props.stepNumber}. ` : ''}Install the plugin
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Install the Manifest plugin for OpenClaw so your agent's activity is tracked automatically.
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
          <CopyButton text={INSTALL_CMD} />
          <div>
            <span class="modal-terminal__prompt">$</span>
            <span class="modal-terminal__code">{INSTALL_CMD}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupStepInstall;
export { CopyButton };
