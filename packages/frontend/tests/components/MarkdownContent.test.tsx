import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@solidjs/testing-library';
import hljs from 'highlight.js';
import MarkdownContent from '../../src/components/benchmark/MarkdownContent';

describe('MarkdownContent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders headings, bold, and lists as HTML', () => {
    const { container } = render(() => (
      <MarkdownContent
        text={'## Title\n\nSome **bold** text.\n\n- one\n- two\n- three'}
      />
    ));
    expect(container.querySelector('h2')?.textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('renders inline code and fenced code blocks', () => {
    const { container } = render(() => (
      <MarkdownContent text={'use `foo` then:\n\n```js\nconst x = 1;\n```'} />
    ));
    expect(container.querySelector('p code')?.textContent).toBe('foo');
    const pre = container.querySelector('pre');
    expect(pre).toBeDefined();
    expect(pre?.textContent).toContain('const x = 1;');
    expect(pre?.querySelector('code')?.classList.contains('hljs')).toBe(true);
  });

  it('strips embedded <script> tags from untrusted model output', () => {
    const { container } = render(() => (
      <MarkdownContent text={'hello\n\n<script>alert(1)</script>\n\nbye'} />
    ));
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('hello');
    expect(container.textContent).toContain('bye');
  });

  it('strips event handlers like onerror from inline HTML', () => {
    const { container } = render(() => (
      <MarkdownContent text={'<img src=x onerror="alert(1)" alt="x">'} />
    ));
    const img = container.querySelector('img');
    expect(img?.hasAttribute('onerror')).toBe(false);
  });

  it('escapes a fenced code block that has no language', () => {
    const { container } = render(() => (
      <MarkdownContent text={'```\n<b>&"\' not html\n```'} />
    ));
    const code = container.querySelector('pre code');
    expect(code).not.toBeNull();
    // No language → plain branch + escapeHtml: tags are shown literally.
    expect(code?.textContent).toContain('<b>&"\' not html');
    expect(code?.querySelector('b')).toBeNull();
    expect(code?.classList.contains('hljs')).toBe(true);
  });

  it('falls back to escaped plain text when highlight.js throws', () => {
    const spy = vi.spyOn(hljs, 'highlight').mockImplementation(() => {
      throw new Error('hljs boom');
    });
    const { container } = render(() => (
      <MarkdownContent text={'```js\nconst x = "<i>";\n```'} />
    ));
    const code = container.querySelector('pre code');
    expect(code?.textContent).toContain('const x = "<i>";');
    expect(code?.querySelector('i')).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it('renders plain text without markdown gracefully', () => {
    const { container } = render(() => (
      <MarkdownContent text={'Just a plain sentence with no formatting.'} />
    ));
    expect(container.textContent).toContain('Just a plain sentence with no formatting.');
  });
});
