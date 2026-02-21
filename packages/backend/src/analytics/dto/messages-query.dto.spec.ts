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
      status: 'ok',
      service_type: 'agent',
      model: 'gpt-4o',
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
});
