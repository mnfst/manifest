import { API_KEY_PREFIX } from './api-key.constants';

describe('API_KEY_PREFIX', () => {
  it('equals mnfst_', () => {
    expect(API_KEY_PREFIX).toBe('mnfst_');
  });

  it('is a string type', () => {
    expect(typeof API_KEY_PREFIX).toBe('string');
  });
});
