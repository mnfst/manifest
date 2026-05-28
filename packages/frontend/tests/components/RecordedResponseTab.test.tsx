import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';

vi.mock('../../src/components/CodeBlock.jsx', () => ({
  default: (props: { code: string; language: string }) => (
    <pre data-testid={`code-${props.language}`}>{props.code}</pre>
  ),
}));

import {
  HeadersTable,
  ResponseTab,
  ToolsList,
  prettyJson,
} from '../../src/components/RecordedResponseTab.jsx';

describe('prettyJson', () => {
  it('serializes objects with 2-space indent', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('falls back to String() on circular references', () => {
    const c: Record<string, unknown> = {};
    c.self = c;
    expect(prettyJson(c)).toBe('[object Object]');
  });
});

describe('HeadersTable', () => {
  it('renders the empty fallback when headers is null', () => {
    const { container } = render(() => (
      <HeadersTable headers={null} emptyCopy="No headers captured" />
    ));
    expect(container.textContent).toContain('No headers captured');
  });

  it('renders header rows sorted alphabetically', () => {
    const { container } = render(() => (
      <HeadersTable
        headers={{ 'x-zzz': 'last', authorization: 'first' }}
        emptyCopy="empty"
      />
    ));
    const keys = Array.from(
      container.querySelectorAll('.recorded-modal__header-key'),
    ).map((el) => el.textContent);
    expect(keys).toEqual(['authorization', 'x-zzz']);
  });
});

describe('ToolsList', () => {
  it('renders one row per tool with name and optional description', () => {
    const { container } = render(() => (
      <ToolsList
        tools={[
          { type: 'function', function: { name: 'lookup', description: 'find a thing' } },
          { type: 'function', function: { name: 'noop' } },
          { type: 'function', function: {} },
        ]}
      />
    ));
    const rows = container.querySelectorAll('.recorded-modal__tool-def');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('lookup');
    expect(rows[0].textContent).toContain('find a thing');
    expect(rows[1].textContent).toContain('noop');
    expect(rows[2].textContent).toContain('unknown');
  });
});

describe('ResponseTab', () => {
  it('shows the empty-state when responseBody is null', () => {
    const { container } = render(() => <ResponseTab responseBody={null} />);
    expect(container.textContent).toContain('Response body not captured');
  });

  it('renders a stream payload as a plaintext code block', () => {
    const { container } = render(() => (
      <ResponseTab responseBody={{ type: 'stream', raw_sse: 'data: hello\n\n' }} />
    ));
    expect(container.querySelector('[data-testid="code-plaintext"]')?.textContent).toContain(
      'data: hello',
    );
  });

  it('falls back to JSON code block when the JSON body has no choices', () => {
    const { container } = render(() => (
      <ResponseTab responseBody={{ type: 'json', body: { foo: 'bar' } }} />
    ));
    expect(container.querySelector('[data-testid="code-json"]')?.textContent).toContain('foo');
  });

  it('renders summary / reply / usage when a chat-completion body is captured', () => {
    const { container } = render(() => (
      <ResponseTab
        responseBody={{
          type: 'json',
          body: {
            id: 'chatcmpl-1',
            model: 'gpt-4o',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'hi there' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
          },
        }}
      />
    ));
    expect(container.textContent).toContain('Summary');
    expect(container.textContent).toContain('gpt-4o');
    expect(container.textContent).toContain('chatcmpl-1');
    expect(container.textContent).toContain('stop');
    expect(container.textContent).toContain('Reply');
    expect(container.textContent).toContain('hi there');
    expect(container.textContent).toContain('Usage');
    expect(container.textContent).toContain('prompt_tokens');
  });

  it('renders the "Other choices" section when n > 1', () => {
    const { container } = render(() => (
      <ResponseTab
        responseBody={{
          type: 'json',
          body: {
            choices: [
              { index: 0, message: { content: 'first' }, finish_reason: 'stop' },
              { index: 1, message: { content: 'second' }, finish_reason: 'length' },
              { index: 2, message: { content: 'third' } },
            ],
          },
        }}
      />
    ));
    expect(container.textContent).toContain('Other choices');
    expect(container.textContent).toContain('second');
    expect(container.textContent).toContain('third');
  });
});
