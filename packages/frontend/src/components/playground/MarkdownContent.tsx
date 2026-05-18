import { createMemo, type Component } from 'solid-js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

marked.use({
  async: false,
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      if (lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        try {
          const html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
          return `<pre><code class="hljs language-${language}">${html}</code></pre>`;
        } catch {
          /* fall through to escaped plain */
        }
      }
      return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>`;
    },
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Props {
  text: string;
  class?: string;
}

const MarkdownContent: Component<Props> = (props) => {
  const html = createMemo(() => {
    const parsed = marked.parse(props.text ?? '') as string;
    return DOMPurify.sanitize(parsed, {
      ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
      FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'script'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'style'],
    });
  });

  return <div class={props.class} innerHTML={html()} />;
};

export default MarkdownContent;
