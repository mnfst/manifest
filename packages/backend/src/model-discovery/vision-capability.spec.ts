import { detectVisionCapability } from './provider-model-fetcher.service';

describe('detectVisionCapability', () => {
  describe('openai', () => {
    it('returns true for gpt-4o family', () => {
      expect(detectVisionCapability('gpt-4o', 'openai')).toBe(true);
      expect(detectVisionCapability('gpt-4o-mini', 'openai')).toBe(true);
      expect(detectVisionCapability('gpt-4o-2024-08-06', 'openai')).toBe(true);
    });

    it('returns true for gpt-4-turbo family', () => {
      expect(detectVisionCapability('gpt-4-turbo', 'openai')).toBe(true);
      expect(detectVisionCapability('gpt-4-turbo-preview', 'openai')).toBe(true);
    });

    it('returns true for gpt-4-vision variants', () => {
      expect(detectVisionCapability('gpt-4-1106-vision-preview', 'openai')).toBe(true);
    });

    it('returns false for non-vision OpenAI models', () => {
      expect(detectVisionCapability('gpt-3.5-turbo', 'openai')).toBe(false);
      expect(detectVisionCapability('o1-mini', 'openai')).toBe(false);
      expect(detectVisionCapability('o3', 'openai')).toBe(false);
    });
  });

  describe('anthropic', () => {
    it('returns true for claude-3 family', () => {
      expect(detectVisionCapability('claude-3-opus-20240229', 'anthropic')).toBe(true);
      expect(detectVisionCapability('claude-3-5-sonnet-20241022', 'anthropic')).toBe(true);
      expect(detectVisionCapability('claude-3-haiku', 'anthropic')).toBe(true);
      expect(detectVisionCapability('claude-3.7-sonnet', 'anthropic')).toBe(true);
    });

    it('returns true for claude-4 family', () => {
      expect(detectVisionCapability('claude-4-opus', 'anthropic')).toBe(true);
      expect(detectVisionCapability('opus-4-0', 'anthropic')).toBe(true);
    });

    it('returns false for older Anthropic models', () => {
      expect(detectVisionCapability('claude-2.1', 'anthropic')).toBe(false);
      expect(detectVisionCapability('claude-instant-1.2', 'anthropic')).toBe(false);
    });
  });

  describe('gemini', () => {
    it('returns true for every gemini model', () => {
      expect(detectVisionCapability('gemini-2.5-pro', 'gemini')).toBe(true);
      expect(detectVisionCapability('gemini-flash', 'gemini')).toBe(true);
      expect(detectVisionCapability('anything', 'gemini')).toBe(true);
    });
  });

  describe('deepseek', () => {
    it('returns true for deepseek-vl2 and deepseek-v3', () => {
      expect(detectVisionCapability('deepseek-vl2', 'deepseek')).toBe(true);
      expect(detectVisionCapability('deepseek-v3', 'deepseek')).toBe(true);
    });

    it('returns false for other deepseek models', () => {
      expect(detectVisionCapability('deepseek-chat', 'deepseek')).toBe(false);
      expect(detectVisionCapability('deepseek-reasoner', 'deepseek')).toBe(false);
    });
  });

  describe('mistral', () => {
    it('returns true for mistral-large and pixtral', () => {
      expect(detectVisionCapability('mistral-large-latest', 'mistral')).toBe(true);
      expect(detectVisionCapability('pixtral-12b-2409', 'mistral')).toBe(true);
    });

    it('returns false for other mistral models', () => {
      expect(detectVisionCapability('mistral-small-latest', 'mistral')).toBe(false);
      expect(detectVisionCapability('codestral-latest', 'mistral')).toBe(false);
    });
  });

  describe('xai', () => {
    it('returns true for grok-2-vision and all grok-3 variants', () => {
      expect(detectVisionCapability('grok-2-vision-1212', 'xai')).toBe(true);
      expect(detectVisionCapability('grok-3', 'xai')).toBe(true);
      expect(detectVisionCapability('grok-3-mini', 'xai')).toBe(true);
    });

    it('returns false for grok-2 without vision and grok-beta', () => {
      expect(detectVisionCapability('grok-2-1212', 'xai')).toBe(false);
      expect(detectVisionCapability('grok-beta', 'xai')).toBe(false);
    });
  });

  describe('qwen', () => {
    it('returns true for qwen-vl, qvq, and qwq', () => {
      expect(detectVisionCapability('qwen-vl-max', 'qwen')).toBe(true);
      expect(detectVisionCapability('qvq-72b-preview', 'qwen')).toBe(true);
      expect(detectVisionCapability('qwq-32b', 'qwen')).toBe(true);
    });

    it('returns false for other qwen models', () => {
      expect(detectVisionCapability('qwen2.5-72b-instruct', 'qwen')).toBe(false);
    });
  });

  describe('zai', () => {
    it('returns true for glm-4v and cogview', () => {
      expect(detectVisionCapability('glm-4v', 'zai')).toBe(true);
      expect(detectVisionCapability('cogview-3', 'zai')).toBe(true);
    });

    it('returns false for other zai models', () => {
      expect(detectVisionCapability('glm-4-plus', 'zai')).toBe(false);
    });
  });

  describe('providers without vision', () => {
    it('returns false for moonshot', () => {
      expect(detectVisionCapability('moonshot-v1-8k', 'moonshot')).toBe(false);
    });

    it('returns false for minimax native models', () => {
      expect(detectVisionCapability('MiniMax-M1.1', 'minimax')).toBe(false);
      expect(detectVisionCapability('MiniMax-M2', 'minimax')).toBe(false);
    });

    it('returns false for openrouter (metadata unavailable)', () => {
      expect(detectVisionCapability('anthropic/claude-3.5-sonnet', 'openrouter')).toBe(false);
    });

    it('returns false for ollama and ollama-cloud', () => {
      expect(detectVisionCapability('llama3.2:11b', 'ollama')).toBe(false);
      expect(detectVisionCapability('gpt-oss:120b', 'ollama-cloud')).toBe(false);
    });

    it('returns false for copilot', () => {
      expect(detectVisionCapability('gpt-4', 'copilot')).toBe(false);
    });

    it('returns false for unknown providers', () => {
      expect(detectVisionCapability('some-model', 'unknown-provider')).toBe(false);
    });
  });
});
