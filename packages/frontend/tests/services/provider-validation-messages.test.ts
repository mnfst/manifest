import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../src/i18n/index.js';
import {
  getProvider,
  validateApiKey,
  validateSubscriptionKey,
  type CredentialValidationResult,
} from '../../src/services/provider-utils.js';
import { credentialValidationMessage } from '../../src/services/provider-validation-messages.js';

function validationMessage(result: CredentialValidationResult): string {
  if (result.valid) throw new Error('Expected an invalid credential');
  return credentialValidationMessage(result.error);
}

describe('credentialValidationMessage', () => {
  afterEach(async () => {
    await setLocale('en');
  });

  it('formats every API-key validation outcome in English', async () => {
    await setLocale('en');
    const openai = getProvider('openai')!;
    const anthropic = getProvider('anthropic')!;

    expect(validationMessage(validateApiKey(openai, ''))).toBe('API key is required');
    expect(
      validationMessage(
        validateApiKey(anthropic, 'wrong-prefix-key-that-is-long-enough-for-validation'),
      ),
    ).toBe('Anthropic keys start with "sk-ant-"');
    expect(validationMessage(validateApiKey(openai, 'sk-short'))).toBe(
      'Key is too short (minimum 50 characters)',
    );
  });

  it('formats every subscription-token validation outcome in English', async () => {
    await setLocale('en');
    const openai = getProvider('openai')!;
    const anthropic = getProvider('anthropic')!;

    expect(validationMessage(validateSubscriptionKey(anthropic, ''))).toBe('Token is required');
    expect(
      validationMessage(validateSubscriptionKey(anthropic, 'sk-wrong-prefix-long-enough-token')),
    ).toBe('Anthropic subscription tokens start with "sk-ant-oat"');
    expect(validationMessage(validateSubscriptionKey(openai, 'sk-proj-1234567890abcdef'))).toBe(
      'This looks like an API key. Use the API Key tab instead.',
    );
    expect(validationMessage(validateSubscriptionKey(openai, 'short'))).toBe(
      'Token is too short (minimum 10 characters)',
    );
  });

  it('formats every API-key validation outcome in Russian', async () => {
    await setLocale('ru');
    const openai = getProvider('openai')!;
    const anthropic = getProvider('anthropic')!;

    expect(validationMessage(validateApiKey(openai, ''))).toBe('Введите API-ключ');
    expect(
      validationMessage(
        validateApiKey(anthropic, 'wrong-prefix-key-that-is-long-enough-for-validation'),
      ),
    ).toBe('API-ключи Anthropic начинаются с «sk-ant-»');
    expect(validationMessage(validateApiKey(openai, 'sk-short'))).toBe(
      'API-ключ слишком короткий (минимум 50 символов)',
    );
  });

  it('formats every subscription-token validation outcome in Russian', async () => {
    await setLocale('ru');
    const openai = getProvider('openai')!;
    const anthropic = getProvider('anthropic')!;

    expect(validationMessage(validateSubscriptionKey(anthropic, ''))).toBe('Введите токен');
    expect(
      validationMessage(validateSubscriptionKey(anthropic, 'sk-wrong-prefix-long-enough-token')),
    ).toBe('Токены подписки Anthropic начинаются с «sk-ant-oat»');
    expect(validationMessage(validateSubscriptionKey(openai, 'sk-proj-1234567890abcdef'))).toBe(
      'Похоже, это API-ключ. Используйте вкладку «API-ключ».',
    );
    expect(validationMessage(validateSubscriptionKey(openai, 'short'))).toBe(
      'Токен слишком короткий (минимум 10 символов)',
    );
  });
});
