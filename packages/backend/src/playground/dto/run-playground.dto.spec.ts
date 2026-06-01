import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PlaygroundPayloadShapeConstraint, RunPlaygroundDto } from './run-playground.dto';

function toDto(data: Record<string, unknown>): RunPlaygroundDto {
  return plainToInstance(RunPlaygroundDto, data);
}

const VALID_BASE = {
  agentName: 'demo',
  model: 'openai/gpt-4o-mini',
  provider: 'openai',
};

describe('RunPlaygroundDto', () => {
  describe('payload-shape constraint', () => {
    it('passes when only `messages` is set', async () => {
      const dto = toDto({
        ...VALID_BASE,
        messages: [{ role: 'user', content: 'hello' }],
      });
      const errors = await validate(dto, { whitelist: true });
      expect(errors).toHaveLength(0);
    });

    it('passes when only `rawRequestBody` is set', async () => {
      const dto = toDto({
        ...VALID_BASE,
        rawRequestBody: { messages: [{ role: 'user', content: 'replay' }] },
      });
      const errors = await validate(dto, { whitelist: true });
      expect(errors).toHaveLength(0);
    });

    it('fails when both `messages` and `rawRequestBody` are set', async () => {
      const dto = toDto({
        ...VALID_BASE,
        messages: [{ role: 'user', content: 'hi' }],
        rawRequestBody: { messages: [{ role: 'user', content: 'hi' }] },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const flat = JSON.stringify(errors);
      expect(flat).toContain('exactly one of `messages` or `rawRequestBody` must be provided');
    });

    // The XOR constraint is attached to `agentName` (a non-optional field)
    // rather than `messages`/`rawRequestBody` so @IsOptional can't
    // short-circuit it. Hence this case correctly fails.
    it('rejects when neither `messages` nor `rawRequestBody` is provided', async () => {
      const dto = toDto({ ...VALID_BASE });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const hasShape = errors.some((e) =>
        Object.keys(e.constraints ?? {}).includes('PlaygroundPayloadShape'),
      );
      expect(hasShape).toBe(true);
    });

    it('fails when `messages: []` (empty arrays count as not-set per ArrayMinSize)', async () => {
      const dto = toDto({ ...VALID_BASE, messages: [] });
      const errors = await validate(dto);
      // Either ArrayMinSize OR the XOR constraint triggers — both are correct
      // signals that an empty messages array is rejected.
      expect(errors.length).toBeGreaterThan(0);
    });

    it('fails when `rawRequestBody` is an array (must be a plain object)', async () => {
      // class-transformer + class-validator will reject this through @IsObject
      // and/or the shape constraint. Either failure is acceptable; the test
      // asserts the DTO is not accepted.
      const dto = toDto({ ...VALID_BASE, rawRequestBody: [{ role: 'user' }] });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // `null` rawRequestBody + missing messages = "neither" path; the XOR
    // constraint on `agentName` rejects it just like the bare case.
    it('rejects `rawRequestBody: null` when messages is also absent', async () => {
      const dto = toDto({ ...VALID_BASE, rawRequestBody: null });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const hasShape = errors.some((e) =>
        Object.keys(e.constraints ?? {}).includes('PlaygroundPayloadShape'),
      );
      expect(hasShape).toBe(true);
    });
  });

  describe('field validation', () => {
    it('rejects an agent name with disallowed characters', async () => {
      const dto = toDto({
        ...VALID_BASE,
        agentName: 'bad name!',
        messages: [{ role: 'user', content: 'hi' }],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'agentName')).toBe(true);
    });

    it('rejects a position above the supported column count', async () => {
      const dto = toDto({
        ...VALID_BASE,
        messages: [{ role: 'user', content: 'hi' }],
        position: 99,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'position')).toBe(true);
    });

    it('rejects a runId that is not a UUID', async () => {
      const dto = toDto({
        ...VALID_BASE,
        messages: [{ role: 'user', content: 'hi' }],
        runId: 'not-a-uuid',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'runId')).toBe(true);
    });

    it('rejects a message with an unsupported role', async () => {
      const dto = toDto({
        ...VALID_BASE,
        messages: [{ role: 'tool', content: 'hi' }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects message content longer than the cap', async () => {
      const dto = toDto({
        ...VALID_BASE,
        messages: [{ role: 'user', content: 'x'.repeat(60_000) }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('PlaygroundPayloadShapeConstraint (unit)', () => {
  // Direct calls let us cover defaultMessage() and the validate() branches
  // without dragging the DTO machinery in.
  const constraint = new PlaygroundPayloadShapeConstraint();
  const args = (obj: Record<string, unknown>) =>
    ({ object: obj }) as unknown as Parameters<typeof constraint.validate>[1];

  it('rejects when both fields are absent', () => {
    expect(constraint.validate(undefined, args({}))).toBe(false);
  });

  it('accepts a non-empty messages array', () => {
    expect(constraint.validate(undefined, args({ messages: [{}] }))).toBe(true);
  });

  it('rejects an empty messages array', () => {
    expect(constraint.validate(undefined, args({ messages: [] }))).toBe(false);
  });

  it('accepts a plain rawRequestBody object', () => {
    expect(constraint.validate(undefined, args({ rawRequestBody: { foo: 'bar' } }))).toBe(true);
  });

  it('rejects an array rawRequestBody', () => {
    expect(constraint.validate(undefined, args({ rawRequestBody: [] }))).toBe(false);
  });

  it('rejects a null rawRequestBody', () => {
    expect(constraint.validate(undefined, args({ rawRequestBody: null }))).toBe(false);
  });

  it('rejects when both shapes are present (xor failure)', () => {
    expect(
      constraint.validate(undefined, args({ messages: [{}], rawRequestBody: { foo: 'bar' } })),
    ).toBe(false);
  });

  it('exposes a default error message', () => {
    expect(constraint.defaultMessage()).toContain('exactly one of');
  });
});
