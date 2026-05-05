import { createSignal, onCleanup, Show, type Component } from 'solid-js';
import { highlight } from '../services/highlight';
import { copyText } from '../services/clipboard';

interface Props {
  open: boolean;
  markdown: string;
  onClose: () => void;
}

const NEW_GIST_URL = 'https://gist.github.com/';

const GistModal: Component<Props> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const [copyError, setCopyError] = createSignal<string | null>(null);

  const close = () => {
    setCopied(false);
    setCopyError(null);
    props.onClose();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  const handleCopy = async () => {
    setCopyError(null);
    const result = await copyText(props.markdown);
    if (result.ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopyError(result.reason || 'Could not copy');
    }
  };

  const handleOpenAndCopy = async () => {
    await handleCopy();
    window.open(NEW_GIST_URL, '_blank', 'noopener,noreferrer');
  };

  // Track keyboard listener while open.
  // Solid's effect-via-prop pattern: only attach when open changes to true.
  let attached = false;
  const sync = () => {
    if (props.open && !attached) {
      document.addEventListener('keydown', onKey);
      attached = true;
    } else if (!props.open && attached) {
      document.removeEventListener('keydown', onKey);
      attached = false;
    }
  };
  // Run sync once on render and whenever props.open flips.
  // (Effect-style via createSignal getter — Solid re-runs the JSX accessors.)
  const _open = () => {
    sync();
    return props.open;
  };
  onCleanup(() => {
    if (attached) document.removeEventListener('keydown', onKey);
  });

  const highlighted = () => highlight(props.markdown, 'markdown');

  return (
    <Show when={_open()}>
      <div
        class="gist-modal__overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gist-modal-title"
      >
        <div class="gist-modal">
          <header class="gist-modal__head">
            <div class="gist-modal__title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <strong id="gist-modal-title">Save to GitHub Gist</strong>
            </div>
            <button
              type="button"
              class="gist-modal__close"
              onClick={close}
              aria-label="Close"
              title="Close (Esc)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
          <p class="gist-modal__hint">
            Copy this markdown report and paste it into the new gist tab. API keys are redacted for
            safe sharing.
          </p>
          <div class="gist-modal__preview">
            <pre class="code-view__pre">
              <code class="hljs language-markdown" innerHTML={highlighted()} />
            </pre>
          </div>
          <Show when={copyError()}>
            <p class="gist-modal__error">{copyError()}</p>
          </Show>
          <footer class="gist-modal__actions">
            <button type="button" class="gist-modal__btn-secondary" onClick={handleCopy}>
              <Show
                when={copied()}
                fallback={
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy markdown
                  </>
                }
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </Show>
            </button>
            <button type="button" class="gist-modal__btn-primary" onClick={handleOpenAndCopy}>
              Copy & open new gist
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </footer>
        </div>
      </div>
    </Show>
  );
};

export default GistModal;
