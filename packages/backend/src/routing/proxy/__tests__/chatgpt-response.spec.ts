import { fromResponsesResponse, collectChatGptSseResponse } from '../chatgpt-adapter';

describe('ChatGPT Adapter – fromResponsesResponse', () => {
  it('converts Responses API output to OpenAI chat completion format', () => {
    const data = {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'Hello there!' }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    };
    const result = fromResponsesResponse(data, 'gpt-5');

    expect(result.object).toBe('chat.completion');
    expect(result.model).toBe('gpt-5');
    expect((result.id as string).startsWith('chatcmpl-')).toBe(true);
    expect(typeof result.created).toBe('number');

    const choices = result.choices as {
      index: number;
      message: { role: string; content: string };
    }[];
    expect(choices).toHaveLength(1);
    expect(choices[0].message.role).toBe('assistant');
    expect(choices[0].message.content).toBe('Hello there!');
    expect(choices[0].index).toBe(0);

    const usage = result.usage as Record<string, number>;
    expect(usage.prompt_tokens).toBe(10);
    expect(usage.completion_tokens).toBe(5);
    expect(usage.total_tokens).toBe(15);
  });

  it('concatenates multiple text parts', () => {
    const data = {
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'Part 1. ' },
            { type: 'output_text', text: 'Part 2.' },
          ],
        },
      ],
    };
    const result = fromResponsesResponse(data, 'gpt-5');
    const choices = result.choices as { message: { content: string } }[];

    expect(choices[0].message.content).toBe('Part 1. Part 2.');
  });

  it('converts function_call output items to tool_calls', () => {
    const data = {
      output: [
        {
          type: 'function_call',
          call_id: 'call_abc',
          name: 'get_weather',
          arguments: '{"location":"Paris"}',
        },
      ],
    };
    const result = fromResponsesResponse(data, 'gpt-5');
    const choices = result.choices as {
      message: {
        content: string | null;
        tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
      };
      finish_reason: string;
    }[];

    expect(choices[0].message.content).toBeNull();
    expect(choices[0].message.tool_calls).toEqual([
      {
        id: 'call_abc',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
      },
    ]);
    expect(choices[0].finish_reason).toBe('tool_calls');
  });

  it('combines text and function_call output items', () => {
    const data = {
      output: [
        { type: 'message', content: [{ type: 'output_text', text: 'Let me check.' }] },
        { type: 'function_call', call_id: 'call_1', name: 'search', arguments: '{}' },
      ],
    };
    const result = fromResponsesResponse(data, 'gpt-5');
    const choices = result.choices as {
      message: { content: string | null; tool_calls?: unknown[] };
      finish_reason: string;
    }[];

    expect(choices[0].message.content).toBe('Let me check.');
    expect(choices[0].message.tool_calls).toHaveLength(1);
    expect(choices[0].finish_reason).toBe('tool_calls');
  });

  it('handles empty output', () => {
    const result = fromResponsesResponse({}, 'gpt-5');
    const choices = result.choices as { message: { content: string | null } }[];

    expect(choices[0].message.content).toBeNull();
  });

  it('handles output item with no content', () => {
    const data = { output: [{ type: 'message' }] };
    const result = fromResponsesResponse(data, 'gpt-5');
    const choices = result.choices as { message: { content: string | null } }[];

    expect(choices[0].message.content).toBeNull();
  });

  it('defaults usage to zeros when missing', () => {
    const data = { output: [] };
    const result = fromResponsesResponse(data, 'gpt-5');
    const usage = result.usage as Record<string, number>;

    expect(usage.prompt_tokens).toBe(0);
    expect(usage.completion_tokens).toBe(0);
    expect(usage.total_tokens).toBe(0);
  });

  it('extracts cached_tokens from usage details', () => {
    const data = {
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hi' }] }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        input_tokens_details: { cached_tokens: 42 },
      },
    };
    const result = fromResponsesResponse(data, 'gpt-5');
    const usage = result.usage as Record<string, number>;

    expect(usage.cache_read_tokens).toBe(42);
  });
});

describe('ChatGPT Adapter – collectChatGptSseResponse', () => {
  it('collects text deltas into a non-streaming response', () => {
    const sse = [
      'event: response.output_text.delta\ndata: {"delta":"Hello"}',
      'event: response.output_text.delta\ndata: {"delta":" world"}',
      'event: response.completed\ndata: {"response":{"usage":{"input_tokens":10,"output_tokens":2,"total_tokens":12},"output":[{"type":"message"}]}}',
    ].join('\n\n');

    const result = collectChatGptSseResponse(sse, 'gpt-5');
    const choices = result.choices as { message: { content: string }; finish_reason: string }[];

    expect(result.object).toBe('chat.completion');
    expect(result.model).toBe('gpt-5');
    expect(choices[0].message.content).toBe('Hello world');
    expect(choices[0].finish_reason).toBe('stop');

    const usage = result.usage as Record<string, number>;
    expect(usage.prompt_tokens).toBe(10);
    expect(usage.completion_tokens).toBe(2);
  });

  it('collects function calls from SSE events', () => {
    const sse = [
      'event: response.output_item.added\ndata: {"item":{"type":"function_call","call_id":"call_1","name":"get_weather"},"output_index":0}',
      'event: response.function_call_arguments.delta\ndata: {"delta":"{\\"city\\":","output_index":0}',
      'event: response.function_call_arguments.delta\ndata: {"delta":"\\"Paris\\"}","output_index":0}',
      'event: response.completed\ndata: {"response":{"output":[{"type":"function_call"}],"usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8}}}',
    ].join('\n\n');

    const result = collectChatGptSseResponse(sse, 'gpt-5');
    const choices = result.choices as {
      message: { tool_calls: { id: string; function: { name: string; arguments: string } }[] };
      finish_reason: string;
    }[];

    expect(choices[0].finish_reason).toBe('tool_calls');
    expect(choices[0].message.tool_calls).toHaveLength(1);
    expect(choices[0].message.tool_calls[0].id).toBe('call_1');
    expect(choices[0].message.tool_calls[0].function.name).toBe('get_weather');
    expect(choices[0].message.tool_calls[0].function.arguments).toBe('{"city":"Paris"}');
  });

  it('handles function calls at non-zero output_index (mixed output items)', () => {
    const sse = [
      'event: response.output_text.delta\ndata: {"delta":"Let me check."}',
      'event: response.output_item.added\ndata: {"item":{"type":"function_call","call_id":"call_2","name":"search"},"output_index":1}',
      'event: response.function_call_arguments.delta\ndata: {"delta":"{\\"q\\":\\"test\\"}","output_index":1}',
      'event: response.completed\ndata: {"response":{"output":[{"type":"message"},{"type":"function_call"}],"usage":{"input_tokens":8,"output_tokens":4,"total_tokens":12}}}',
    ].join('\n\n');

    const result = collectChatGptSseResponse(sse, 'gpt-5');
    const choices = result.choices as {
      message: {
        content: string;
        tool_calls: { id: string; function: { name: string; arguments: string } }[];
      };
      finish_reason: string;
    }[];

    expect(choices[0].message.content).toBe('Let me check.');
    expect(choices[0].message.tool_calls).toHaveLength(1);
    expect(choices[0].message.tool_calls[0].id).toBe('call_2');
    expect(choices[0].message.tool_calls[0].function.arguments).toBe('{"q":"test"}');
    expect(choices[0].finish_reason).toBe('tool_calls');
  });

  it('handles empty SSE text', () => {
    const result = collectChatGptSseResponse('', 'gpt-5');
    const choices = result.choices as { message: { content: string | null } }[];

    expect(choices[0].message.content).toBeNull();
  });
});
