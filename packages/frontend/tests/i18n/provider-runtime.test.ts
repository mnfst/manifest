import { beforeEach, describe, expect, it } from 'vitest';
import { initializeI18n, setLocale } from '../../src/i18n/index.js';
import {
  DEFAULT_STAGE,
  PROVIDERS,
  SPECIFICITY_STAGES,
  STAGES,
} from '../../src/services/providers.js';

describe('localized provider runtime metadata', () => {
  beforeEach(async () => {
    await initializeI18n({ storage: null, languages: ['en-US'] });
  });

  it('keeps stable provider, region, and stage identifiers', async () => {
    const qwen = PROVIDERS.find((provider) => provider.id === 'qwen')!;
    const regionValues = qwen.apiKeyEndpointRegions!.map((region) => region.value);
    const stageIds = [DEFAULT_STAGE, ...STAGES, ...SPECIFICITY_STAGES].map((stage) => stage.id);

    await setLocale('ru');

    expect(qwen.id).toBe('qwen');
    expect(qwen.apiKeyEndpointRegions!.map((region) => region.value)).toEqual(regionValues);
    expect([DEFAULT_STAGE, ...STAGES, ...SPECIFICITY_STAGES].map((stage) => stage.id)).toEqual(
      stageIds,
    );
  });

  it('updates provider copy and nested region labels reactively', async () => {
    const qwen = PROVIDERS.find((provider) => provider.id === 'qwen')!;

    expect(qwen.subscriptionKeyPlaceholder).toBe('Paste your Qwen Token Plan API key');
    expect(qwen.apiKeyEndpointRegions![0]!.label).toBe('Auto-detect');

    await setLocale('ru');

    expect(qwen.subscriptionKeyPlaceholder).toBe('Вставьте API-ключ Qwen Token Plan');
    expect(qwen.apiKeyEndpointRegions![0]!.label).toBe('Определить автоматически');
  });

  it('updates routing stage labels and descriptions reactively', async () => {
    expect(DEFAULT_STAGE.label).toBe('Default');
    expect(STAGES[0]!.label).toBe('Simple');

    await setLocale('ru');

    expect(DEFAULT_STAGE.label).toBe('По умолчанию');
    expect(STAGES[0]!.label).toBe('Простой');
    expect(SPECIFICITY_STAGES[0]!.desc).toBe('Написание, отладка и рефакторинг кода.');
  });
});
