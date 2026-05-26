import { DEFAULT_RESPONSE_MODE, RESPONSE_MODES, isResponseMode } from '../src/response-mode';
import {
  DEFAULT_OUTPUT_MODALITY,
  OUTPUT_MODALITIES,
  isOutputModality,
} from '../src/output-modality';

describe('response-mode', () => {
  it('defines buffered as the default and validates supported modes', () => {
    expect(DEFAULT_RESPONSE_MODE).toBe('buffered');
    expect(RESPONSE_MODES).toEqual(['buffered', 'stream']);
    expect(isResponseMode('buffered')).toBe(true);
    expect(isResponseMode('stream')).toBe(true);
    expect(isResponseMode('video')).toBe(false);
    expect(isResponseMode(null)).toBe(false);
  });
});

describe('output-modality', () => {
  it('defines text as the only supported output modality today', () => {
    expect(DEFAULT_OUTPUT_MODALITY).toBe('text');
    expect(OUTPUT_MODALITIES).toEqual(['text']);
    expect(isOutputModality('text')).toBe(true);
    expect(isOutputModality('image')).toBe(false);
    expect(isOutputModality(undefined)).toBe(false);
  });
});
