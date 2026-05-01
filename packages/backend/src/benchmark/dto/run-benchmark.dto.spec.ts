import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BenchmarkMessageDto,
  RawRequestBodySizeConstraint,
  RAW_REQUEST_BODY_MAX_BYTES,
  RunBenchmarkDto,
} from './run-benchmark.dto';

describe('RawRequestBodySizeConstraint', () => {
  const constraint = new RawRequestBodySizeConstraint();

  it('treats undefined and null as valid (the field is optional)', () => {
    expect(constraint.validate(undefined)).toBe(true);
    expect(constraint.validate(null)).toBe(true);
  });

  it('rejects non-object values', () => {
    expect(constraint.validate('not-an-object')).toBe(false);
    expect(constraint.validate(123)).toBe(false);
    expect(constraint.validate(true)).toBe(false);
  });

  it('accepts an empty object', () => {
    expect(constraint.validate({})).toBe(true);
  });

  it('accepts a normal-sized payload below the cap', () => {
    expect(constraint.validate({ messages: [{ role: 'user', content: 'hi' }] })).toBe(true);
  });

  it('rejects a payload that serializes above the cap', () => {
    // Build a string whose byte length pushes the entire JSON above the cap.
    const oversized = { messages: 'x'.repeat(RAW_REQUEST_BODY_MAX_BYTES + 1) };
    expect(constraint.validate(oversized)).toBe(false);
  });

  it('catches stringify failures (e.g. circular refs) and rejects the value', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(constraint.validate(cycle)).toBe(false);
  });

  it('returns the documented default message', () => {
    expect(constraint.defaultMessage()).toBe(
      `rawRequestBody exceeds ${RAW_REQUEST_BODY_MAX_BYTES} bytes`,
    );
  });
});

describe('RunBenchmarkDto', () => {
  function basePlain(): Record<string, unknown> {
    return {
      agentName: 'demo-agent',
      model: 'openai/gpt-4o',
      provider: 'openai',
      authType: 'api_key',
      messages: [{ role: 'user', content: 'hello' }],
    };
  }

  it('passes validation for a minimal happy-path payload', async () => {
    const dto = plainToInstance(RunBenchmarkDto, basePlain());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a too-large rawRequestBody via the @Validate constraint', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: { junk: 'x'.repeat(RAW_REQUEST_BODY_MAX_BYTES + 1) },
    });
    const errors = await validate(dto);
    const rawErr = errors.find((e) => e.property === 'rawRequestBody');
    expect(rawErr).toBeDefined();
    expect(Object.keys(rawErr?.constraints ?? {})).toContain('rawRequestBodySize');
  });

  it('accepts a small rawRequestBody', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: { messages: [{ role: 'user', content: 'hi' }], temperature: 0.7 },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('runs nested validation on messages and rejects empty content', async () => {
    // The nested @ValidateNested + @Type(() => BenchmarkMessageDto) wiring is
    // what causes BenchmarkMessageDto's @IsNotEmpty on `content` to bubble up.
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      messages: [{ role: 'user', content: '' }],
    });
    const errors = await validate(dto);
    const messagesErr = errors.find((e) => e.property === 'messages');
    expect(messagesErr).toBeDefined();
    const childErr = messagesErr?.children?.[0]?.children?.find((c) => c.property === 'content');
    expect(childErr).toBeDefined();
    expect(Object.keys(childErr?.constraints ?? {})).toContain('isNotEmpty');
  });

  it('rejects an invalid agent name pattern', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      agentName: 'has spaces',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'agentName')).toBeDefined();
  });

  it('rejects a non-UUID runId', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      runId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'runId')).toBeDefined();
  });

  it('rejects a custom:<uuid> provider with a clear message (not a TypeError)', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      provider: 'custom:abc12345-0000-4000-8000-000000000000',
    });
    const errors = await validate(dto);
    const providerErr = errors.find((e) => e.property === 'provider');
    expect(providerErr).toBeDefined();
    expect(Object.values(providerErr?.constraints ?? {})).toEqual(
      expect.arrayContaining([expect.stringContaining('Custom providers')]),
    );
  });
});

describe('BenchmarkMessageDto', () => {
  it('rejects an unknown role', async () => {
    const dto = plainToInstance(BenchmarkMessageDto, { role: 'tool', content: 'hi' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'role')).toBeDefined();
  });
});

describe('RawRequestBodyShapeConstraint', () => {
  function basePlain(): Record<string, unknown> {
    return {
      agentName: 'demo-agent',
      model: 'openai/gpt-4o',
      provider: 'openai',
      authType: 'api_key',
      messages: [{ role: 'user', content: 'hello' }],
    };
  }

  it('rejects a rawRequestBody that lacks a messages array', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: { temperature: 0.5 },
    });
    const errors = await validate(dto);
    const rawErr = errors.find((e) => e.property === 'rawRequestBody');
    expect(Object.keys(rawErr?.constraints ?? {})).toContain('rawRequestBodyShape');
  });

  it('rejects a rawRequestBody whose messages is not an array', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: { messages: 'oops' },
    });
    const errors = await validate(dto);
    expect(
      Object.keys(errors.find((e) => e.property === 'rawRequestBody')?.constraints ?? {}),
    ).toContain('rawRequestBodyShape');
  });

  it('rejects keys starting with _ ($ etc.) — anti prototype-pollution + side-channel hygiene', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: { messages: [], _extractedSignatures: [{ id: 'x' }] },
    });
    const errors = await validate(dto);
    expect(
      Object.keys(errors.find((e) => e.property === 'rawRequestBody')?.constraints ?? {}),
    ).toContain('rawRequestBodyShape');
  });

  it('rejects a `prototype` property name (anti prototype-pollution guard)', async () => {
    // class-transformer chokes on a literal `constructor` key during
    // plainToInstance, so we exercise the prototype-pollution guard via
    // `prototype` instead. `__proto__` literals become the prototype rather
    // than a property when JS parses the object, so they never reach the
    // walk — that's a class-transformer/JS limitation, not a bug in the
    // shape validator.
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: { messages: [], prototype: { polluted: true } },
    });
    const errors = await validate(dto);
    expect(
      Object.keys(errors.find((e) => e.property === 'rawRequestBody')?.constraints ?? {}),
    ).toContain('rawRequestBodyShape');
  });

  it('rejects payloads nested deeper than 8 levels', async () => {
    let leaf: Record<string, unknown> = { final: 1 };
    for (let i = 0; i < 12; i++) leaf = { nested: leaf };
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: { messages: [], nested: leaf },
    });
    const errors = await validate(dto);
    expect(
      Object.keys(errors.find((e) => e.property === 'rawRequestBody')?.constraints ?? {}),
    ).toContain('rawRequestBodyShape');
  });

  it('accepts a normal replay body (messages + tools + temperature)', async () => {
    const dto = plainToInstance(RunBenchmarkDto, {
      ...basePlain(),
      rawRequestBody: {
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ type: 'function', function: { name: 'foo', parameters: {} } }],
        temperature: 0.7,
      },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
