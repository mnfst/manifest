import { createMemo, createResource, Show, type Component } from 'solid-js';
import type { Tokens } from 'marked';
import { highlight, isSupported } from '../../services/syntax-highlight.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// marked's fenced-code renderer. Supported languages get highlighted with the
// slim hljs core; everything else (and unlabelled blocks) is escaped to plain
// text. Both paths keep the `hljs` class so styles/syntax-highlight.css applies.
function renderCodeBlock({ text, lang }: Tokens.Code): string {
  if (lang && isSupported(lang)) {
    return `<pre><code class="hljs language-${lang}">${highlight(text, lang)}</code></pre>`;
  }
  return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>`;
}

type MarkdownRenderer = (text: string) => string;

// `marked` (~70 KB) + `dompurify` (~50 KB) are only needed once an assistant
// message renders, so load them lazily and once. The module-level promise also
// guarantees `marked.use()` runs a single time no matter how many
// MarkdownContent instances mount.
let rendererPromise: Promise<MarkdownRenderer> | null = null;

function loadRenderer(): Promise<MarkdownRenderer> {
  if (!rendererPromise) {
    rendererPromise = Promise.all([import('marked'), import('dompurify')]).then(
      ([{ marked }, { default: DOMPurify }]) => {
        marked.use({
          async: false,
          gfm: true,
          breaks: true,
          renderer: { code: renderCodeBlock },
        });
        return (text: string) =>
          DOMPurify.sanitize(marked.parse(text) as string, {
            ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
            FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'script'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'style'],
          });
      },
    );
  }
  return rendererPromise;
}

interface Props {
  text: string;
  class?: string;
}

const MarkdownContent: Component<Props> = (props) => {
  const [renderMarkdown] = createResource(loadRenderer);
  const html = createMemo(() => {
    const render = renderMarkdown();
    return render ? render(props.text ?? '') : null;
  });

  return (
    <Show
      when={html() != null}
      fallback={<pre class={`${props.class ?? ''} markdown-loading`.trim()}>{props.text}</pre>}
    >
      <div class={props.class} innerHTML={html()!} />
    </Show>
  );
};

export default MarkdownContent;
