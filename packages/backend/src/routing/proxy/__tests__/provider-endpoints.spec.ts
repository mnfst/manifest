import { PROVIDER_ENDPOINTS, resolveEndpointKey } from '../provider-endpoints';

describe('provider-endpoints', () => {
  describe('resolveEndpointKey', () => {
    it('should resolve known providers by lowercase name', () => {
      expect(resolveEndpointKey('openai')).toBe('openai');
      expect(resolveEndpointKey('anthropic')).toBe('anthropic');
      expect(resolveEndpointKey('google')).toBe('google');
      expect(resolveEndpointKey('ollama')).toBe('ollama');
      expect(resolveEndpointKey('zai')).toBe('zai');
    });

    it('should resolve gemini alias to google', () => {
      expect(resolveEndpointKey('gemini')).toBe('google');
    });

    it('should resolve z.ai alias to zai', () => {
      expect(resolveEndpointKey('z.ai')).toBe('zai');
    });

    it('should return null for unknown provider', () => {
      expect(resolveEndpointKey('unknown')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(resolveEndpointKey('OpenAI')).toBe('openai');
      expect(resolveEndpointKey('ANTHROPIC')).toBe('anthropic');
    });
  });

  describe('PROVIDER_ENDPOINTS', () => {
    it('zai buildPath returns correct path', () => {
      const path = PROVIDER_ENDPOINTS['zai'].buildPath('test-model');
      expect(path).toBe('/api/paas/v4/chat/completions');
    });

    it('ollama buildHeaders returns Content-Type only', () => {
      const headers = PROVIDER_ENDPOINTS['ollama'].buildHeaders('');
      expect(headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('ollama uses openai format', () => {
      expect(PROVIDER_ENDPOINTS['ollama'].format).toBe('openai');
    });

    it('zai uses openai format', () => {
      expect(PROVIDER_ENDPOINTS['zai'].format).toBe('openai');
    });
  });
});
