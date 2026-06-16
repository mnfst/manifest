import { inputModalitiesFromCapabilities } from './model-capabilities';

describe('inputModalitiesFromCapabilities', () => {
  it('keeps text first and appends each novel capability once', () => {
    const out = inputModalitiesFromCapabilities([
      'text',
      'stream',
      'tools',
      'image',
      'image',
      'audio',
    ] as never);
    expect(out).toEqual(['text', 'image', 'audio']);
  });

  it('defaults to text-only for nullish capabilities', () => {
    expect(inputModalitiesFromCapabilities(null)).toEqual(['text']);
  });
});
