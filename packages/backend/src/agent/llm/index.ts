import { ChatOpenAI } from '@langchain/openai';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'mock';

/**
 * LLM configuration options
 */
export interface LLMConfig {
  apiKey?: string;
  modelName?: string;
  temperature?: number;
}

/**
 * Default LLM configuration
 */
const DEFAULT_CONFIG: LLMConfig = {
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
};

/**
 * Check if OpenAI API key is available
 */
export function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Create an LLM instance based on provider
 * POC: OpenAI with mock fallback when API key is not available
 */
export function createLLM(
  provider: LLMProvider = 'openai',
  config: LLMConfig = {}
): BaseChatModel {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // If no API key and provider is openai, fall back to mock
  if (provider === 'openai' && !mergedConfig.apiKey && !process.env.OPENAI_API_KEY) {
    console.warn('⚠️  No OpenAI API key found. Using mock LLM for POC testing.');
    provider = 'mock';
  }

  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        openAIApiKey: mergedConfig.apiKey || process.env.OPENAI_API_KEY,
        modelName: mergedConfig.modelName,
        temperature: mergedConfig.temperature,
      });
    case 'mock':
      // Return a fake LLM that produces placeholder responses
      // The actual tool logic handles the real work
      return new FakeListChatModel({
        responses: ['Mock LLM response - tools handle the actual logic'],
      });
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Get current LLM provider from environment
 */
export function getCurrentProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'openai';
  return provider as LLMProvider;
}
