/**
 * Concurrent / interleaved use of createAnthropicStreamTransformer.
 *
 * The transformer is stateful (per-instance StreamState held in closure). These
 * tests exercise multiple transformers in parallel and interleave their event
 * handling to verify state isolation — no cross-stream bleeding of usage
 * counters, tool-call indices, or thinking-block accumulators.
 */
import { createAnthropicStreamTransformer } from '../anthropic-adapter';

describe('createAnthropicStreamTransformer concurrent use', () => {
  it('keeps tool_use indices isolated between two interleaved transformers', () => {
    const a = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
    const b = createAnthropicStreamTransformer('claude-sonnet-4-20250514');

    a('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":1}}}');
    b('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":1}}}');

    // First tool on each — both should be index 0, not 0 and 1.
    const aTool = a(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_a1","name":"x"}}',
    );
    const bTool = b(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_b1","name":"y"}}',
    );

    const aData = JSON.parse(aTool!.replace('data: ', '').trim());
    const bData = JSON.parse(bTool!.replace('data: ', '').trim());

    expect(aData.choices[0].delta.tool_calls[0].index).toBe(0);
    expect(aData.choices[0].delta.tool_calls[0].id).toBe('toolu_a1');
    expect(bData.choices[0].delta.tool_calls[0].index).toBe(0);
    expect(bData.choices[0].delta.tool_calls[0].id).toBe('toolu_b1');

    // Second tool only on transformer a — should be index 1 on a, b unaffected.
    const aTool2 = a(
      'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_a2","name":"z"}}',
    );
    const aData2 = JSON.parse(aTool2!.replace('data: ', '').trim());
    expect(aData2.choices[0].delta.tool_calls[0].index).toBe(1);

    // A subsequent input_json_delta on b for its first tool stays at index 0.
    const bDelta = b(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{}"}}',
    );
    const bDeltaData = JSON.parse(bDelta!.replace('data: ', '').trim());
    expect(bDeltaData.choices[0].delta.tool_calls[0].index).toBe(0);
  });

  it('attributes usage tokens to the transformer that received the events', () => {
    const a = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
    const b = createAnthropicStreamTransformer('claude-haiku-4-5-20251001');

    a(
      'event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":100,"cache_read_input_tokens":10,"cache_creation_input_tokens":5}}}',
    );
    b(
      'event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":7,"cache_read_input_tokens":2,"cache_creation_input_tokens":1}}}',
    );

    // Finalize a — its usage should reflect a's message_start counts only.
    const aEnd = a(
      'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":20}}',
    );
    const aParts = aEnd!.split('\n\n').filter(Boolean);
    const aUsage = JSON.parse(aParts[1].replace('data: ', '')).usage;
    expect(aUsage.prompt_tokens).toBe(115); // 100 + 10 + 5
    expect(aUsage.completion_tokens).toBe(20);
    expect(aUsage.cache_read_tokens).toBe(10);
    expect(aUsage.cache_creation_tokens).toBe(5);

    // b's state is untouched by a's finalize.
    const bEnd = b(
      'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}',
    );
    const bParts = bEnd!.split('\n\n').filter(Boolean);
    const bUsage = JSON.parse(bParts[1].replace('data: ', '')).usage;
    expect(bUsage.prompt_tokens).toBe(10); // 7 + 2 + 1
    expect(bUsage.completion_tokens).toBe(3);
    expect(bUsage.cache_read_tokens).toBe(2);
    expect(bUsage.cache_creation_tokens).toBe(1);
  });

  it('keeps the model tag isolated to each transformer in interleaved chunks', () => {
    const a = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
    const b = createAnthropicStreamTransformer('claude-haiku-4-5-20251001');

    const textEvent =
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}';

    a('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":1}}}');
    b('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":1}}}');

    const aChunk = a(textEvent);
    const bChunk = b(textEvent);

    const aData = JSON.parse(aChunk!.replace('data: ', '').trim());
    const bData = JSON.parse(bChunk!.replace('data: ', '').trim());
    expect(aData.model).toBe('claude-sonnet-4-20250514');
    expect(bData.model).toBe('claude-haiku-4-5-20251001');
    expect(aData.choices[0].delta.content).toBe('hi');
    expect(bData.choices[0].delta.content).toBe('hi');
  });

  it('isolates thinking-block accumulators between concurrent transformers', () => {
    const callbackA = jest.fn();
    const callbackB = jest.fn();
    const a = createAnthropicStreamTransformer('claude-sonnet-4-20250514', callbackA);
    const b = createAnthropicStreamTransformer('claude-sonnet-4-20250514', callbackB);

    // Interleave: both start, both seed thinking blocks at index 0, both
    // append different text via thinking_delta, both add a tool_use, both
    // finalize. The callbacks must fire with each transformer's own data.
    a('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":5}}}');
    b('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":5}}}');

    a(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
    );
    b(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
    );

    a(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"A-think"}}',
    );
    b(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"B-think"}}',
    );

    a(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sigA"}}',
    );
    b(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sigB"}}',
    );

    a(
      'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_A","name":"search"}}',
    );
    b(
      'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_B","name":"search"}}',
    );

    a(
      'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":2}}',
    );
    b(
      'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":2}}',
    );

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledTimes(1);
    expect(callbackA).toHaveBeenCalledWith('toolu_A', [
      { type: 'thinking', thinking: 'A-think', signature: 'sigA' },
    ]);
    expect(callbackB).toHaveBeenCalledWith('toolu_B', [
      { type: 'thinking', thinking: 'B-think', signature: 'sigB' },
    ]);
  });

  it('keeps state isolated when one transformer is finalized while another keeps streaming', () => {
    const callbackA = jest.fn();
    const callbackB = jest.fn();
    const a = createAnthropicStreamTransformer('claude-sonnet-4-20250514', callbackA);
    const b = createAnthropicStreamTransformer('claude-sonnet-4-20250514', callbackB);

    // Start both.
    a('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":50}}}');
    b('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":50}}}');

    // a accumulates a thinking block + tool_use + finalizes.
    a(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
    );
    a(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"A reasoning"}}',
    );
    a(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sigA"}}',
    );
    a(
      'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_first_A","name":"search"}}',
    );
    a(
      'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":10}}',
    );

    // Now b continues — its state must be unaffected by a's flush.
    b(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
    );
    b(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"B reasoning"}}',
    );
    b(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sigB"}}',
    );
    b(
      'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_first_B","name":"search"}}',
    );
    b(
      'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":7}}',
    );

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackA).toHaveBeenCalledWith('toolu_first_A', [
      { type: 'thinking', thinking: 'A reasoning', signature: 'sigA' },
    ]);
    expect(callbackB).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledWith('toolu_first_B', [
      { type: 'thinking', thinking: 'B reasoning', signature: 'sigB' },
    ]);
  });

  it('does not cross-pollinate input_json_delta args between two interleaved tool_use streams', () => {
    const a = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
    const b = createAnthropicStreamTransformer('claude-sonnet-4-20250514');

    a('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":5}}}');
    b('event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":5}}}');

    a(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_A","name":"fnA"}}',
    );
    b(
      'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_B","name":"fnB"}}',
    );

    const aArg = a(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"a\\":1}"}}',
    );
    const bArg = b(
      'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"b\\":2}"}}',
    );

    const aData = JSON.parse(aArg!.replace('data: ', '').trim());
    const bData = JSON.parse(bArg!.replace('data: ', '').trim());
    expect(aData.choices[0].delta.tool_calls[0].function.arguments).toBe('{"a":1}');
    expect(bData.choices[0].delta.tool_calls[0].function.arguments).toBe('{"b":2}');
  });

  it('runs many concurrent transformers without any state leaking', () => {
    // Smoke test for a higher-concurrency case — 10 transformers running
    // in interleaved lockstep. Each must finalize with its own usage figures.
    const N = 10;
    const transformers = Array.from({ length: N }, (_, i) =>
      createAnthropicStreamTransformer(`claude-model-${i}`),
    );

    transformers.forEach((t, i) => {
      t(
        `event: message_start\n${JSON.stringify({
          type: 'message_start',
          message: { usage: { input_tokens: i + 1 } },
        })}`,
      );
    });

    transformers.forEach((t, i) => {
      t(
        `event: content_block_start\n${JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: `toolu_${i}`, name: 'fn' },
        })}`,
      );
    });

    transformers.forEach((t, i) => {
      const result = t(
        `event: message_delta\n${JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: 'tool_use' },
          usage: { output_tokens: (i + 1) * 10 },
        })}`,
      );
      const parts = result!.split('\n\n').filter(Boolean);
      const finish = JSON.parse(parts[0].replace('data: ', ''));
      const usage = JSON.parse(parts[1].replace('data: ', ''));

      expect(finish.model).toBe(`claude-model-${i}`);
      expect(finish.choices[0].finish_reason).toBe('tool_calls');
      expect(usage.usage.prompt_tokens).toBe(i + 1);
      expect(usage.usage.completion_tokens).toBe((i + 1) * 10);
    });
  });
});
