import {
  DEFAULT_DELIVERY_MODE,
  DELIVERY_MODES,
  isDeliveryMode,
} from '../src/delivery-mode';
import {
  DEFAULT_OUTPUT_MODALITY,
  OUTPUT_MODALITIES,
  isOutputModality,
} from '../src/output-modality';

describe('delivery-mode', () => {
  it('defines buffered as the default and validates supported modes', () => {
    expect(DEFAULT_DELIVERY_MODE).toBe('buffered');
    expect(DELIVERY_MODES).toEqual(['buffered', 'stream']);
    expect(isDeliveryMode('buffered')).toBe(true);
    expect(isDeliveryMode('stream')).toBe(true);
    expect(isDeliveryMode('video')).toBe(false);
    expect(isDeliveryMode(null)).toBe(false);
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
