import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MessagesQueryDto } from './messages-query.dto';

describe('MessagesQueryDto', () => {
  it('allows omitting all fields', async () => {
    const dto = plainToInstance(MessagesQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid string fields', async () => {
    const dto = plainToInstance(MessagesQueryDto, {
      range: '24h',
      provider: 'openai',
      service_type: 'agent',
      cursor: 'abc123',
      agent_name: 'my-bot',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid numeric fields', async () => {
    const dto = plainToInstance(MessagesQueryDto, {
      cost_min: 0,
      cost_max: 100,
      limit: 50,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects negative cost_min', async () => {
    const dto = plainToInstance(MessagesQueryDto, { cost_min: -1 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects cost_max over 999999', async () => {
    const dto = plainToInstance(MessagesQueryDto, { cost_max: 1000000 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects limit below 1', async () => {
    const dto = plainToInstance(MessagesQueryDto, { limit: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects limit above 200', async () => {
    const dto = plainToInstance(MessagesQueryDto, { limit: 201 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts each known status value', async () => {
    for (const status of ['ok', 'error', 'rate_limited', 'fallback_error', 'errors']) {
      const dto = plainToInstance(MessagesQueryDto, { status });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown status value', async () => {
    const dto = plainToInstance(MessagesQueryDto, { status: 'pending' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(flat.join('\n')).toMatch(/status must be one of/);
  });
});
