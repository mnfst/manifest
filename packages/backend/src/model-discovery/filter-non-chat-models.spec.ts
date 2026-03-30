import {
  filterNonChatModels,
  UNIVERSAL_NON_CHAT_RE,
  PROVIDER_NON_CHAT,
} from './provider-model-fetcher.service';
import { DiscoveredModel } from './model-fetcher';

function makeModel(id: string, provider = 'test'): DiscoveredModel {
  return {
    id,
    displayName: id,
    provider,
    contextWindow: 128000,
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
  };
}

describe('filterNonChatModels', () => {
  describe('universal non-chat patterns', () => {
    const nonChatIds = [
      'text-embedding-ada-002',
      'text-embedding-3-large',
      'tts-1',
      'tts-1-hd',
      'whisper-1',
      'dall-e-3',
      'dall-e-2',
      'imagen-3.0-generate-002',
      'cogview-3-plus',
      'wanx-v1',
      'sambert-v1',
      'paraformer-v2',
      'speech-to-text-model',
      'voice-alloy',
      'audio-turbo-v1',
    ];

    it.each(nonChatIds)('filters out "%s" for any provider', (modelId) => {
      const models = [makeModel(modelId), makeModel('gpt-4o')];
      const result = filterNonChatModels(models, 'unknown-provider');
      expect(result.map((m) => m.id)).toEqual(['gpt-4o']);
    });

    it('keeps chat-compatible models through universal filter', () => {
      const chatModels = [
        makeModel('gpt-4o'),
        makeModel('claude-sonnet-4'),
        makeModel('gemini-2.5-flash'),
        makeModel('deepseek-chat'),
      ];
      const result = filterNonChatModels(chatModels, 'unknown-provider');
      expect(result).toHaveLength(4);
    });
  });

  describe('universal regex', () => {
    it('matches embed case-insensitively', () => {
      expect(UNIVERSAL_NON_CHAT_RE.test('text-EMBEDDING-large')).toBe(true);
    });

    it('does not match partial words that happen to contain "embed"', () => {
      // "embed" substring in the middle still matches by design
      expect(UNIVERSAL_NON_CHAT_RE.test('some-embed-model')).toBe(true);
    });
  });

  describe('OpenAI-specific patterns', () => {
    const openaiNonChat = [
      'text-moderation-latest',
      'davinci-002',
      'babbage-002',
      'text-davinci-003',
      'gpt-4o-mini-realtime-preview',
      'gpt-4o-transcribe',
      'sora-v1',
      'gpt-3.5-turbo-instruct',
      'gpt-4o-audio-preview',
      'chatgpt-image-latest',
      'chatgpt-image-i-20250326',
    ];

    it.each(openaiNonChat)('filters out "%s" for openai config key', (modelId) => {
      const models = [makeModel(modelId), makeModel('gpt-4o')];
      const result = filterNonChatModels(models, 'openai');
      expect(result.map((m) => m.id)).toEqual(['gpt-4o']);
    });

    it('keeps chat models for openai', () => {
      const models = [makeModel('gpt-4o'), makeModel('gpt-4o-mini')];
      const result = filterNonChatModels(models, 'openai');
      expect(result).toHaveLength(2);
    });

    it('keeps search models for openai', () => {
      const models = [makeModel('gpt-5-search-api'), makeModel('gpt-4o-search-preview')];
      const result = filterNonChatModels(models, 'openai');
      expect(result).toHaveLength(2);
    });
  });

  describe('OpenAI subscription patterns', () => {
    it('filters moderation models for openai-subscription', () => {
      const models = [makeModel('text-moderation-latest'), makeModel('gpt-4o')];
      const result = filterNonChatModels(models, 'openai-subscription');
      expect(result.map((m) => m.id)).toEqual(['gpt-4o']);
    });

    it('filters audio models for openai-subscription', () => {
      const models = [makeModel('gpt-4o-audio-preview'), makeModel('gpt-4o')];
      const result = filterNonChatModels(models, 'openai-subscription');
      expect(result.map((m) => m.id)).toEqual(['gpt-4o']);
    });

    it('filters chatgpt-image models for openai-subscription', () => {
      const models = [makeModel('chatgpt-image-latest'), makeModel('gpt-4o')];
      const result = filterNonChatModels(models, 'openai-subscription');
      expect(result.map((m) => m.id)).toEqual(['gpt-4o']);
    });
  });

  describe('Gemini-specific patterns', () => {
    it('filters aqs- prefixed models', () => {
      const models = [makeModel('aqs-gemini-model'), makeModel('gemini-2.5-flash')];
      const result = filterNonChatModels(models, 'gemini');
      expect(result.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    });

    it('filters nano-banana models', () => {
      const models = [makeModel('nano-banana'), makeModel('gemini-2.5-pro')];
      const result = filterNonChatModels(models, 'gemini');
      expect(result.map((m) => m.id)).toEqual(['gemini-2.5-pro']);
    });

    it('filters deep-research models', () => {
      const models = [
        makeModel('deep-research-pro-preview-12-2025'),
        makeModel('gemini-2.5-flash'),
      ];
      const result = filterNonChatModels(models, 'gemini');
      expect(result.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    });

    it('filters computer-use models', () => {
      const models = [
        makeModel('gemini-2.5-computer-use-preview-10-2025'),
        makeModel('gemini-2.5-flash'),
      ];
      const result = filterNonChatModels(models, 'gemini');
      expect(result.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    });

    it('filters lyria models', () => {
      const models = [makeModel('lyria-3-clip-preview'), makeModel('gemini-2.5-pro')];
      const result = filterNonChatModels(models, 'gemini');
      expect(result.map((m) => m.id)).toEqual(['gemini-2.5-pro']);
    });

    it('keeps gemini-image and gemini-robotics models', () => {
      const models = [
        makeModel('gemini-2.5-flash-image'),
        makeModel('gemini-3-pro-image-preview'),
        makeModel('gemini-robotics-er-1.5-preview'),
      ];
      const result = filterNonChatModels(models, 'gemini');
      expect(result).toHaveLength(3);
    });
  });

  describe('Mistral-specific patterns', () => {
    it('filters mistral-ocr model', () => {
      const models = [makeModel('mistral-ocr'), makeModel('mistral-large-latest')];
      const result = filterNonChatModels(models, 'mistral');
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest']);
    });

    it('filters mistral-moderation models', () => {
      const models = [
        makeModel('mistral-moderation-latest'),
        makeModel('mistral-moderation-2411'),
        makeModel('mistral-large-latest'),
      ];
      const result = filterNonChatModels(models, 'mistral');
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest']);
    });

    it('filters voxtral transcribe models', () => {
      const models = [makeModel('voxtral-mini-transcribe-2507'), makeModel('mistral-large-latest')];
      const result = filterNonChatModels(models, 'mistral');
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest']);
    });

    it('filters voxtral realtime models', () => {
      const models = [
        makeModel('voxtral-mini-realtime-latest'),
        makeModel('voxtral-mini-realtime-2602'),
        makeModel('voxtral-mini-transcribe-realtime-2602'),
        makeModel('mistral-large-latest'),
      ];
      const result = filterNonChatModels(models, 'mistral');
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest']);
    });

    it('keeps voxtral chat models', () => {
      const models = [makeModel('voxtral-mini-latest'), makeModel('voxtral-small-latest')];
      const result = filterNonChatModels(models, 'mistral');
      expect(result).toHaveLength(2);
    });

    it('keeps mistral-vibe-cli models', () => {
      const models = [makeModel('mistral-vibe-cli-latest'), makeModel('mistral-vibe-cli-fast')];
      const result = filterNonChatModels(models, 'mistral');
      expect(result).toHaveLength(2);
    });
  });

  describe('xAI-specific patterns', () => {
    const xaiNonChat = ['grok-imagine-image', 'grok-imagine-image-pro', 'grok-imagine-video'];

    it.each(xaiNonChat)('filters out "%s" for xai config key', (modelId) => {
      const models = [makeModel(modelId), makeModel('grok-3')];
      const result = filterNonChatModels(models, 'xai');
      expect(result.map((m) => m.id)).toEqual(['grok-3']);
    });

    it('keeps chat models for xai', () => {
      const models = [makeModel('grok-3'), makeModel('grok-3-mini')];
      const result = filterNonChatModels(models, 'xai');
      expect(result).toHaveLength(2);
    });
  });

  describe('providers without specific filters', () => {
    it('only applies universal filter for unknown config keys', () => {
      const models = [makeModel('some-chat-model'), makeModel('text-embedding-ada')];
      const result = filterNonChatModels(models, 'anthropic');
      expect(result.map((m) => m.id)).toEqual(['some-chat-model']);
    });
  });

  describe('empty input', () => {
    it('returns empty array when given empty input', () => {
      expect(filterNonChatModels([], 'openai')).toEqual([]);
    });
  });

  describe('PROVIDER_NON_CHAT registry', () => {
    it('has entries for openai, openai-subscription, gemini, mistral, and xai', () => {
      expect(PROVIDER_NON_CHAT).toHaveProperty('openai');
      expect(PROVIDER_NON_CHAT).toHaveProperty('openai-subscription');
      expect(PROVIDER_NON_CHAT).toHaveProperty('gemini');
      expect(PROVIDER_NON_CHAT).toHaveProperty('mistral');
      expect(PROVIDER_NON_CHAT).toHaveProperty('xai');
    });
  });
});
