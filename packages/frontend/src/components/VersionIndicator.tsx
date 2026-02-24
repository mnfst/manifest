import { createSignal, Show } from "solid-js";
import { updateInfo } from "../services/local-mode.js";

const UPGRADE_COMMAND = "openclaw plugins upgrade manifest";

const VersionIndicator = () => {
  const info = () => updateInfo();
  const hasUpdate = () => info()?.updateAvailable === true;
  const [copied, setCopied] = createSignal(false);

  function copyCommand() {
    navigator.clipboard.writeText(UPGRADE_COMMAND).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <Show when={info()}>
      <div
        class="version-indicator"
        classList={{ "version-indicator--update": hasUpdate() }}
        aria-label={
          hasUpdate()
            ? `Update available: v${info()!.latestVersion}`
            : `Version ${info()!.version}`
        }
      >
        <Show
          when={hasUpdate()}
          fallback={<span>v{info()!.version}</span>}
        >
          <div class="version-indicator__tooltip-wrap">
            <span>New version available</span>
            <div class="version-indicator__bubble" role="tooltip">
              <span class="version-indicator__range">
                v{info()!.version} &rarr; v{info()!.latestVersion}
              </span>
              <div class="version-indicator__command-row">
                <code class="version-indicator__command">
                  {UPGRADE_COMMAND}
                </code>
                <button
                  class="version-indicator__copy-btn"
                  onClick={copyCommand}
                  title={copied() ? "Copied!" : "Copy command"}
                  aria-label="Copy upgrade command"
                >
                  {copied() ? "\u2713" : "\u2398"}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default VersionIndicator;
