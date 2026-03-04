import { PROVIDER_ENDPOINTS, resolveEndpointKey } from '../provider-endpoints';

describe('provider-endpoints', () => {
  describe('PROVIDER_ENDPOINTS', () => {
    it('zai buildPath returns the correct path', () => {
      const zai = PROVIDER_ENDPOINTS['zai'];
      expect(zai.buildPath('model')).toBe('/api/paas/v4/chat/completions');
    });

    it('ollama uses OLLAMA_HOST as baseUrl', () => {
      const ollama = PROVIDER_ENDPOINTS['ollama'];
      // Default is http://localhost:11434
      expect(ollama.baseUrl).toMatch(/localhost:11434/);
    });

    it('ollama buildHeaders returns content-type', () => {
      const ollama = PROVIDER_ENDPOINTS['ollama'];
      expect(ollama.buildHeaders('')).toEqual({ 'Content-Type': 'application/json' });
    });

    it('google buildPath includes model name', () => {
      const google = PROVIDER_ENDPOINTS['google'];
      expect(google.buildPath('gemini-2.0-flash')).toBe(
        '/v1beta/models/gemini-2.0-flash:generateContent',
      );
    });

    it('anthropic buildHeaders includes x-api-key and anthropic-version', () => {
      const anthropic = PROVIDER_ENDPOINTS['anthropic'];
      const headers = anthropic.buildHeaders('sk-ant-test');
      expect(headers['x-api-key']).toBe('sk-ant-test');
      expect(headers['anthropic-version']).toBe('2023-06-01');
    });
  });

  describe('resolveEndpointKey', () => {
    it('resolves known providers', () => {
      expect(resolveEndpointKey('openai')).toBe('openai');
      expect(resolveEndpointKey('OpenAI')).toBe('openai');
      expect(resolveEndpointKey('Google')).toBe('google');
    });

    it('resolves aliases', () => {
      expect(resolveEndpointKey('Gemini')).toBe('google');
      expect(resolveEndpointKey('Z.ai')).toBe('zai');
    });

    it('returns null for unknown providers', () => {
      expect(resolveEndpointKey('unknown_provider')).toBeNull();
    });
  });
});
