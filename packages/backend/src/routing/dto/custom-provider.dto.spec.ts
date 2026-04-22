import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateCustomProviderDto,
  UpdateCustomProviderDto,
  CustomProviderModelDto,
} from './custom-provider.dto';

function toDto(data: Record<string, unknown>): CreateCustomProviderDto {
  return plainToInstance(CreateCustomProviderDto, data);
}

function toUpdateDto(data: Record<string, unknown>): UpdateCustomProviderDto {
  return plainToInstance(UpdateCustomProviderDto, data);
}

describe('CreateCustomProviderDto', () => {
  it('accepts valid input', async () => {
    const dto = toDto({
      name: 'Groq',
      base_url: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk_test123',
      models: [{ model_name: 'llama-3.1-70b' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts http URLs for local providers', async () => {
    const dto = toDto({
      name: 'Local OpenAI-compatible',
      base_url: 'http://localhost:8000/v1',
      models: [{ model_name: 'my-model' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts optional pricing fields', async () => {
    const dto = toDto({
      name: 'Test',
      base_url: 'https://api.example.com/v1',
      models: [
        {
          model_name: 'model-a',
          input_price_per_million_tokens: 0.5,
          output_price_per_million_tokens: 1.0,
          context_window: 32000,
        },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty name', async () => {
    const dto = toDto({
      name: '',
      base_url: 'https://api.example.com/v1',
      models: [{ model_name: 'model-a' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects name with special characters', async () => {
    const dto = toDto({
      name: 'Invalid@Provider!',
      base_url: 'https://api.example.com/v1',
      models: [{ model_name: 'model-a' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const nameError = errors.find((e) => e.property === 'name');
    expect(nameError).toBeDefined();
  });

  it('rejects name longer than 50 chars', async () => {
    const dto = toDto({
      name: 'a'.repeat(51),
      base_url: 'https://api.example.com/v1',
      models: [{ model_name: 'model-a' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects empty models array', async () => {
    const dto = toDto({
      name: 'Test',
      base_url: 'https://api.example.com/v1',
      models: [],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing base_url', async () => {
    const dto = toDto({
      name: 'Test',
      models: [{ model_name: 'model-a' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative pricing', async () => {
    const dto = toDto({
      name: 'Test',
      base_url: 'https://api.example.com/v1',
      models: [{ model_name: 'model-a', input_price_per_million_tokens: -1 }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateCustomProviderDto', () => {
  it('accepts all fields (same as create)', async () => {
    const dto = toUpdateDto({
      name: 'Updated',
      base_url: 'https://api.example.com/v2',
      apiKey: 'new-key',
      models: [{ model_name: 'model-b' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts partial update with only name', async () => {
    const dto = toUpdateDto({ name: 'New Name' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts partial update with only models', async () => {
    const dto = toUpdateDto({
      models: [{ model_name: 'model-a' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts empty object (no fields)', async () => {
    const dto = toUpdateDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid name characters', async () => {
    const dto = toUpdateDto({ name: 'Bad@Name!' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects empty models array', async () => {
    const dto = toUpdateDto({ models: [] });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
