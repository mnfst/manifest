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

  it('coerces include_total and include_filter_options flags', async () => {
    const dto = plainToInstance(MessagesQueryDto, {
      include_total: 'false',
      include_filter_options: '1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.include_total).toBe(false);
    expect(dto.include_filter_options).toBe(true);
  });

  it('accepts each known routing_tier value including playground', async () => {
    for (const tier of ['simple', 'standard', 'complex', 'reasoning', 'playground']) {
      const dto = plainToInstance(MessagesQueryDto, { routing_tier: tier });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown routing_tier value', async () => {
    const dto = plainToInstance(MessagesQueryDto, { routing_tier: 'fanciful' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(flat.join('\n')).toMatch(/routing_tier must be one of/);
  });

  it('accepts each known specificity_category value', async () => {
    for (const category of [
      'coding',
      'web_browsing',
      'data_analysis',
      'image_generation',
      'video_generation',
      'social_media',
      'email_management',
      'calendar_management',
      'trading',
    ]) {
      const dto = plainToInstance(MessagesQueryDto, { specificity_category: category });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown specificity_category value', async () => {
    const dto = plainToInstance(MessagesQueryDto, { specificity_category: 'gardening' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(flat.join('\n')).toMatch(/specificity_category must be one of/);
  });

  it('accepts custom header tier ids', async () => {
    const dto = plainToInstance(MessagesQueryDto, { header_tier_id: 'ht-premium' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
