import {
  extractRecordedConversationMessages,
  extractRequestMessages,
  extractRequestTools,
} from '../src/chat-message';

describe('recorded chat message helpers', () => {
  it('reads Anthropic system prompts, tool calls, and tool results', () => {
    expect(
      extractRequestMessages({
        system: 'Be concise.',
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'weather', input: { city: 'Paris' } },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'Sunny' }],
          },
        ],
      }),
    ).toEqual([
      { role: 'system', content: 'Be concise.' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'tool-1',
            type: 'function',
            function: { name: 'weather', arguments: { city: 'Paris' } },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'tool-1', content: 'Sunny' },
    ]);
  });

  it('normalizes Anthropic tool definitions', () => {
    expect(
      extractRequestTools({
        tools: [{ name: 'weather', description: 'Get weather', input_schema: { type: 'object' } }],
      }),
    ).toEqual([
      {
        type: 'function',
        function: {
          name: 'weather',
          description: 'Get weather',
          parameters: { type: 'object' },
        },
      },
    ]);
  });

  it('reconstructs assistant text from a captured SSE response', () => {
    expect(
      extractRecordedConversationMessages(
        { messages: [{ role: 'user', content: 'Hello' }] },
        {
          type: 'stream',
          raw_sse:
            'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: {"choices":[{"delta":{"content":" there"}}]}\n\ndata: [DONE]\n\n',
        },
      ),
    ).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
  });
});
