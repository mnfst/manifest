import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';
import MarkdownContent from '../../src/components/playground/MarkdownContent';

describe('MarkdownContent', () => {
  it('shows raw text while markdown libraries load, then renders HTML', async () => {
    const { container } = render(() => <MarkdownContent text={'## Title'} />);
    // marked + dompurify load lazily, so the first synchronous paint is the
    // raw-text fallback (avoids a layout flash before the chunk arrives).
    const loading = container.querySelector('pre.markdown-loading');
    expect(loading).not.toBeNull();
    expect(loading?.textContent).toBe('## Title');

    await waitFor(() => {
      expect(container.querySelector('h2')?.textContent).toBe('Title');
    });
    expect(container.querySelector('pre.markdown-loading')).toBeNull();
  });

  it('renders headings, bold, and lists as HTML', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'## Title\n\nSome **bold** text.\n\n- one\n- two\n- three'} />
    ));
    await waitFor(() => {
      expect(container.querySelector('h2')?.textContent).toBe('Title');
    });
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('forwards the class prop to the rendered container', async () => {
    const { container } = render(() => <MarkdownContent text={'hi'} class="custom-md" />);
    await waitFor(() => {
      expect(container.querySelector('div.custom-md')).not.toBeNull();
    });
  });

  it('renders inline code and highlights fenced blocks for supported languages', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'use `foo` then:\n\n```typescript\nconst x = 1;\n```'} />
    ));
    await waitFor(() => {
      expect(container.querySelector('pre code')).not.toBeNull();
    });
    expect(container.querySelector('p code')?.textContent).toBe('foo');
    const code = container.querySelector('pre code');
    expect(code?.textContent).toContain('const x = 1;');
    expect(code?.classList.contains('hljs')).toBe(true);
    expect(code?.classList.contains('language-typescript')).toBe(true);
    // Highlighted output carries hljs token spans.
    expect(code?.querySelector('.hljs-keyword')).not.toBeNull();
  });

  it('highlights javascript fences (js alias is registered)', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'```js\nconst x = 1;\n```'} />
    ));
    await waitFor(() => {
      expect(container.querySelector('pre code')).not.toBeNull();
    });
    expect(container.querySelector('pre code .hljs-keyword')).not.toBeNull();
  });

  it('escapes a fenced code block that has no language', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'```\n<b>&"\' not html\n```'} />
    ));
    await waitFor(() => {
      expect(container.querySelector('pre code')).not.toBeNull();
    });
    const code = container.querySelector('pre code');
    expect(code?.textContent).toContain('<b>&"\' not html');
    expect(code?.querySelector('b')).toBeNull();
    expect(code?.classList.contains('hljs')).toBe(true);
    expect(code?.classList.contains('language-')).toBe(false);
  });

  it('escapes fenced blocks for unsupported languages instead of highlighting', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'```rust\nlet x = "<i>";\n```'} />
    ));
    await waitFor(() => {
      expect(container.querySelector('pre code')).not.toBeNull();
    });
    const code = container.querySelector('pre code');
    expect(code?.textContent).toContain('let x = "<i>";');
    expect(code?.querySelector('i')).toBeNull();
    // No grammar registered → no token spans, no language class.
    expect(code?.querySelector('.hljs-keyword')).toBeNull();
    expect(code?.className).toBe('hljs');
  });

  it('strips embedded <script> tags from untrusted model output', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'hello\n\n<script>alert(1)</script>\n\nbye'} />
    ));
    await waitFor(() => {
      expect(container.textContent).toContain('hello');
    });
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('bye');
  });

  it('strips event handlers like onerror from inline HTML', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'<img src=x onerror="alert(1)" alt="x">'} />
    ));
    await waitFor(() => {
      expect(container.querySelector('img')).not.toBeNull();
    });
    expect(container.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  });

  it('renders an empty container when text is nullish', async () => {
    const { container } = render(() => (
      <MarkdownContent text={undefined as unknown as string} />
    ));
    await waitFor(() => {
      expect(container.querySelector('div')).not.toBeNull();
    });
    expect(container.querySelector('div')?.innerHTML).toBe('');
  });

  it('renders plain text without markdown gracefully', async () => {
    const { container } = render(() => (
      <MarkdownContent text={'Just a plain sentence with no formatting.'} />
    ));
    await waitFor(() => {
      expect(container.querySelector('div')).not.toBeNull();
    });
    expect(container.textContent).toContain('Just a plain sentence with no formatting.');
  });
});
