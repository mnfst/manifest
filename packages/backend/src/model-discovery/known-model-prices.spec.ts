import { lookupKnownPrice } from './known-model-prices';

describe('lookupKnownPrice', () => {
  it('should return pricing for moonshot-v1-8k', () => {
    const result = lookupKnownPrice('moonshot-v1-8k');
    expect(result).not.toBeNull();
    expect(result!.input).toBeCloseTo(1.66 / 1_000_000, 12);
    expect(result!.output).toBeCloseTo(1.66 / 1_000_000, 12);
  });

  it('should return pricing for moonshot-v1-32k', () => {
    const result = lookupKnownPrice('moonshot-v1-32k');
    expect(result).not.toBeNull();
  });

  it('should return pricing for moonshot-v1-128k', () => {
    const result = lookupKnownPrice('moonshot-v1-128k');
    expect(result).not.toBeNull();
  });

  it('should return pricing for moonshot-v1-128k-vision-preview', () => {
    const result = lookupKnownPrice('moonshot-v1-128k-vision-preview');
    expect(result).not.toBeNull();
  });

  it('should return pricing for moonshot-v1-auto', () => {
    const result = lookupKnownPrice('moonshot-v1-auto');
    expect(result).not.toBeNull();
  });

  it('should return zero pricing for gemma-3-1b-it', () => {
    const result = lookupKnownPrice('gemma-3-1b-it');
    expect(result).not.toBeNull();
    expect(result!.input).toBe(0);
    expect(result!.output).toBe(0);
  });

  it('should return pricing for gemini-pro-latest', () => {
    const result = lookupKnownPrice('gemini-pro-latest');
    expect(result).not.toBeNull();
    expect(result!.input).toBeCloseTo(1.25 / 1_000_000, 12);
    expect(result!.output).toBeCloseTo(10.0 / 1_000_000, 12);
  });

  it('should return null for unknown model', () => {
    expect(lookupKnownPrice('gpt-4o')).toBeNull();
  });

  it('should return null for partial prefix mismatch', () => {
    expect(lookupKnownPrice('moonshot-v2-8k')).toBeNull();
  });
});
