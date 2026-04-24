import { describe, it, expect } from 'vitest';
import { extractRecordedAssistantText } from '../../src/services/recording-extract';
import type { MessageRecording } from '../../src/services/api';

describe('extractRecordedAssistantText', () => {
  it('returns an empty string when the recording body is missing', () => {
    expect(extractRecordedAssistantText(null)).toBe('');
  });

  it('returns an empty string for an unknown body type', () => {
    expect(
      extractRecordedAssistantText({
        type: 'unknown' as unknown as 'json',
        body: {},
      } as MessageRecording['response_body']),
    ).toBe('');
  });

  it('extracts assistant text from OpenAI-style JSON bodies', () => {
    expect(
      extractRecordedAssistantText({
        type: 'json',
        body: { choices: [{ message: { content: 'hello' } }] },
      }),
    ).toBe('hello');
  });

  it('joins array-of-parts content', () => {
    expect(
      extractRecordedAssistantText({
        type: 'json',
        body: {
          choices: [
            {
              message: {
                content: [
                  { type: 'text', text: 'Hello ' },
                  'world',
                  { type: 'image', url: 'nope' },
                  { text: '!' },
                ],
              },
            },
          ],
        },
      }),
    ).toBe('Hello world!');
  });

  it('concatenates OpenAI SSE deltas and skips [DONE]', () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"lo"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    expect(extractRecordedAssistantText({ type: 'stream', raw_sse: sse })).toBe('Hello');
  });

  it('ignores malformed SSE chunks rather than throwing', () => {
    const sse = [
      'data: not-json',
      '',
      'data: {"choices":[{"delta":{"content":"ok"}}]}',
      '',
    ].join('\n');
    expect(extractRecordedAssistantText({ type: 'stream', raw_sse: sse })).toBe('ok');
  });
});
