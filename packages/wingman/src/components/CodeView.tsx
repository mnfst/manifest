import { createMemo, createSignal, Show, type Component } from 'solid-js';
import { highlight } from '../services/highlight';

interface Props {
  code: string;
  language: string;
  editable?: boolean;
  onChange?: (next: string) => void;
  rows?: number;
}

/**
 * Editable code view that keeps full syntax highlighting. Implements the
 * standard "transparent textarea over a highlighted <pre>" technique:
 *   - the <pre><code>(highlighted html)</code></pre> sits at the back, painted
 *   - the <textarea> sits on top with `color: transparent` and a real caret
 *   - both share font/padding/line-height so the caret aligns over tokens
 *   - on scroll, the textarea's scrollTop is mirrored to the <pre>
 *
 * Trailing newlines are padded in the highlighted layer so the last line
 * stays visible while typing at the end.
 */
const CodeView: Component<Props> = (props) => {
  const [copied, setCopied] = createSignal(false);
  let preRef: HTMLPreElement | undefined;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const highlighted = createMemo(() => {
    // Without this, the trailing newline collapses inside <code> and the
    // textarea's caret on the last empty line drifts above the pre's box.
    const padded = props.code.endsWith('\n') ? props.code + ' ' : props.code;
    return highlight(padded, props.language);
  });

  const onScroll = (e: Event) => {
    if (!preRef) return;
    const ta = e.currentTarget as HTMLTextAreaElement;
    preRef.scrollTop = ta.scrollTop;
    preRef.scrollLeft = ta.scrollLeft;
  };

  return (
    <div class="code-view">
      <div class="code-view__head">
        <span class="code-view__lang">{props.language}</span>
        <button type="button" class="code-view__copy" onClick={handleCopy}>
          {copied() ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Show
        when={props.editable}
        fallback={
          <pre class="code-view__pre">
            <code class={`hljs language-${props.language}`} innerHTML={highlighted()} />
          </pre>
        }
      >
        <div class="code-view__editor">
          <pre
            class="code-view__pre code-view__pre--bg"
            ref={preRef}
            aria-hidden="true"
            tabIndex={-1}
          >
            <code class={`hljs language-${props.language}`} innerHTML={highlighted()} />
          </pre>
          <textarea
            class="code-view__textarea code-view__textarea--overlay"
            spellcheck={false}
            autocomplete="off"
            autocapitalize="off"
            rows={props.rows ?? 14}
            value={props.code}
            onInput={(e) => props.onChange?.(e.currentTarget.value)}
            onScroll={onScroll}
          />
        </div>
      </Show>
    </div>
  );
};

export default CodeView;
