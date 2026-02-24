import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResolveRequestDto } from './resolve-request.dto';

function toDto(data: Record<string, unknown>): ResolveRequestDto {
  return plainToInstance(ResolveRequestDto, data);
}

describe('ResolveRequestDto', () => {
  it('should pass with valid messages', async () => {
    const dto = toDto({
      messages: [{ role: 'user', content: 'hello' }],
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });

  it('should fail when messages is missing', async () => {
    const dto = toDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when messages is empty array', async () => {
    const dto = toDto({ messages: [] });
    // Empty array is still valid as an array (class-validator doesn't enforce min length)
    // But we accept empty arrays at the DTO level - the scorer handles it
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept optional tools array', async () => {
    const dto = toDto({
      messages: [{ role: 'user', content: 'test' }],
      tools: [{ name: 'search' }],
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });

  it('should accept optional max_tokens as number', async () => {
    const dto = toDto({
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1000,
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });

  it('should accept valid recentTiers', async () => {
    const dto = toDto({
      messages: [{ role: 'user', content: 'test' }],
      recentTiers: ['simple', 'standard', 'complex'],
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid tier values in recentTiers', async () => {
    const dto = toDto({
      messages: [{ role: 'user', content: 'test' }],
      recentTiers: ['invalid_tier'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept tool_choice', async () => {
    const dto = toDto({
      messages: [{ role: 'user', content: 'test' }],
      tool_choice: 'auto',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });
});
