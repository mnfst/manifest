import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  localizeModelParamDescription,
  localizeModelParamLabel,
} from '../../src/i18n/model-param-metadata.js';
import { setLocale } from '../../src/i18n/index.js';

describe('model parameter metadata overlay', () => {
  afterEach(async () => {
    await setLocale('en');
  });

  it('localizes a known label and description in Russian', async () => {
    await setLocale('ru');

    expect(localizeModelParamLabel('Temperature')).toBe('Температура');
    expect(
      localizeModelParamDescription(
        'Controls randomness. Lower values make outputs more focused; higher values make them more varied.',
      ),
    ).toBe(
      'Управляет случайностью. Низкие значения делают ответы более сфокусированными, высокие — более разнообразными.',
    );
  });

  it('keeps provider-specific variants of the same path distinct', async () => {
    await setLocale('ru');

    const standard = localizeModelParamDescription(
      'Controls nucleus sampling by limiting generation to tokens within the selected cumulative probability.',
    );
    const deepseek = localizeModelParamDescription(
      'Controls nucleus sampling. In DeepSeek thinking mode this parameter is accepted for compatibility but has no effect.',
    );

    expect(standard).toContain('в пределах заданной совокупной вероятности');
    expect(deepseek).toContain('DeepSeek');
    expect(deepseek).toContain('ни на что не влияет');
    expect(standard).not.toBe(deepseek);
  });

  it('returns unknown and English metadata literally unchanged', async () => {
    await setLocale('ru');
    expect(localizeModelParamLabel('Future provider knob')).toBe('Future provider knob');
    expect(localizeModelParamDescription('A future upstream description.')).toBe(
      'A future upstream description.',
    );

    await setLocale('en');
    expect(localizeModelParamLabel('Temperature')).toBe('Temperature');
    expect(
      localizeModelParamDescription(
        'Controls randomness. Lower values make outputs more focused; higher values make them more varied.',
      ),
    ).toBe(
      'Controls randomness. Lower values make outputs more focused; higher values make them more varied.',
    );
  });

  it('keeps Cyrillic metadata exclusively in the dynamically loaded Russian module', () => {
    const neutralSource = readFileSync(
      resolve(process.cwd(), 'src/i18n/model-param-metadata.ts'),
      'utf8',
    );
    const russianSource = readFileSync(
      resolve(process.cwd(), 'src/i18n/messages/ru/model-param-metadata.ts'),
      'utf8',
    );

    expect(neutralSource).not.toMatch(/\p{Script=Cyrillic}/u);
    expect(neutralSource).not.toContain('messages/ru');
    expect(russianSource).toMatch(/\p{Script=Cyrillic}/u);
  });
});
