import { createSignal, type Component } from 'solid-js';

const CopyButton: Component<{ text: string; disabled?: boolean }> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  const handleCopy = async () => {
    if (props.disabled) return;
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2000);
    }
  };

  return (
    <button
      class="modal-terminal__copy"
      classList={{ 'modal-terminal__copy--disabled': !!props.disabled }}
      onClick={handleCopy}
      disabled={props.disabled}
      title={props.disabled ? 'Reveal key first' : 'Copy'}
      aria-label={
        props.disabled
          ? 'Copy disabled'
          : copied()
            ? 'Copied'
            : failed()
              ? 'Copy failed'
              : 'Copy to clipboard'
      }
    >
      {copied() ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
};

export default CopyButton;
