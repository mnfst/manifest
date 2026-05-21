import { buildForwardBody, derivePromptForHistory } from './playground-payload';
import type { RunPlaygroundDto } from './dto/run-playground.dto';

function dto(overrides: Partial<RunPlaygroundDto>): RunPlaygroundDto {
  return {
    agentName: 'demo',
    model: 'm',
    provider: 'p',
    ...overrides,
  } as RunPlaygroundDto;
}

describe('buildForwardBody', () => {
  it('returns { messages } when messages is set on the dto', () => {
    const out = buildForwardBody(dto({ messages: [{ role: 'user', content: 'hi' }] }));
    expect(out).toEqual({ messages: [{ role: 'user', content: 'hi' }] });
  });

  it('returns the verbatim rawRequestBody when set (replay path)', () => {
    const raw = { input: 'replayed', extra: { nested: true } };
    const out = buildForwardBody(dto({ rawRequestBody: raw }));
    expect(out).toBe(raw);
  });

  it('prefers rawRequestBody over messages when (defensively) both are set', () => {
    // The DTO validator prevents this in practice, but the helper itself
    // shouldn't crash if both arrive — and rawRequestBody being verbatim
    // wins so replays are never silently rewritten.
    const raw = { input: 'replay-wins' };
    const out = buildForwardBody(
      dto({ messages: [{ role: 'user', content: 'ignored' }], rawRequestBody: raw }),
    );
    expect(out).toBe(raw);
  });

  it('returns { messages: [] } when neither messages nor rawRequestBody is set', () => {
    expect(buildForwardBody(dto({}))).toEqual({ messages: [] });
  });
});

describe('derivePromptForHistory', () => {
  it('returns the last user message content from a `messages` array', () => {
    const out = derivePromptForHistory(
      dto({
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'reply' },
          { role: 'user', content: 'second' },
        ],
      }),
    );
    expect(out).toBe('second');
  });

  it('skips assistant messages and returns the most recent user content', () => {
    const out = derivePromptForHistory(
      dto({
        messages: [
          { role: 'user', content: 'asked' },
          { role: 'assistant', content: 'answered' },
        ],
      }),
    );
    expect(out).toBe('asked');
  });

  it('falls back to rawRequestBody.messages when dto.messages is empty', () => {
    // dto.messages = [] should hit the rawRequestBody branch even though
    // the DTO validator forbids both empty messages and a body together.
    const out = derivePromptForHistory(
      dto({
        messages: [],
        rawRequestBody: {
          messages: [
            { role: 'user', content: 'ask-1' },
            { role: 'user', content: 'ask-2' },
          ],
        },
      }),
    );
    expect(out).toBe('ask-2');
  });

  it('extracts a string `input` field from a Responses-API style body', () => {
    const out = derivePromptForHistory(dto({ rawRequestBody: { input: 'hello world' } }));
    expect(out).toBe('hello world');
  });

  it('extracts the last user message from a Responses-API `input` array', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          input: [
            { role: 'system', content: 'sys' },
            { role: 'user', content: 'one' },
            { role: 'user', content: 'two' },
          ],
        },
      }),
    );
    expect(out).toBe('two');
  });

  it('extracts text from Anthropic-style content blocks `[{type:text,text:...}]`', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'block-a ' },
                { type: 'text', text: 'block-b' },
              ],
            },
          ],
        },
      }),
    );
    expect(out).toBe('block-a block-b');
  });

  it('skips an empty trailing user string in rawRequestBody.messages and finds the earlier one', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          messages: [
            { role: 'user', content: 'earlier prompt' },
            { role: 'user', content: '' },
          ],
        },
      }),
    );
    expect(out).toBe('earlier prompt');
  });

  it('skips an empty trailing user string in a Responses-API `input` array', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          input: [
            { role: 'user', content: 'earlier input' },
            { role: 'user', content: '' },
          ],
        },
      }),
    );
    expect(out).toBe('earlier input');
  });

  it('returns an empty string when no recognisable user message is found', () => {
    expect(derivePromptForHistory(dto({}))).toBe('');
    expect(derivePromptForHistory(dto({ rawRequestBody: {} }))).toBe('');
    expect(
      derivePromptForHistory(
        dto({ rawRequestBody: { messages: [{ role: 'assistant', content: 'reply' }] } }),
      ),
    ).toBe('');
  });

  it('returns an empty string when the user message has empty string content', () => {
    // An empty user message should not be returned (the lastUserContent helper
    // only returns non-empty strings) — fall through to rawRequestBody if any.
    const out = derivePromptForHistory(dto({ messages: [{ role: 'user', content: '' }] }));
    expect(out).toBe('');
  });

  it('ignores non-string user content with no text blocks', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          messages: [{ role: 'user', content: 42 as unknown as string }],
        },
      }),
    );
    expect(out).toBe('');
  });

  it('ignores Anthropic content blocks with non-text parts', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', text: null },
                'naked-string',
                null,
                { type: 'tool_use', text: 123 },
              ],
            },
          ],
        },
      }),
    );
    expect(out).toBe('');
  });

  it('skips null entries in the messages array without crashing', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          messages: [null, { role: 'user', content: 'real' }, null],
        },
      }),
    );
    expect(out).toBe('real');
  });

  it('skips Responses API input array entries that are not user messages', () => {
    const out = derivePromptForHistory(
      dto({
        rawRequestBody: {
          input: [{ role: 'assistant', content: 'no' }, null, { role: 'tool', content: 'no' }],
        },
      }),
    );
    expect(out).toBe('');
  });
});
