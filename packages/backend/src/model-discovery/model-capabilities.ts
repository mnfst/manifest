import { PROVIDER_BY_ID_OR_ALIAS } from '../common/constants/providers';
import type { ModelCapability } from 'manifest-shared';

type RawModalities = { input?: string[]; output?: string[] } | undefined;

const MODALITY_CAPABILITIES: ReadonlyMap<string, ModelCapability> = new Map([
  ['text', 'text'],
  ['image', 'image'],
  ['audio', 'audio'],
  ['video', 'video'],
]);

const STREAMING_ENDPOINT_PROVIDERS = new Set([
  'anthropic',
  'copilot',
  'deepseek',
  'gemini',
  'groq',
  'minimax',
  'mistral',
  'moonshot',
  'ollama',
  'ollama-cloud',
  'openai',
  'opencode-go',
  'openrouter',
  'qwen',
  'xai',
  'zai',
]);

export function mergeModelCapabilities(
  ...capabilityLists: Array<readonly ModelCapability[] | null | undefined>
): readonly ModelCapability[] | undefined {
  const merged: ModelCapability[] = [];
  const seen = new Set<ModelCapability>();
  for (const capabilities of capabilityLists) {
    for (const capability of capabilities ?? []) {
      if (seen.has(capability)) continue;
      seen.add(capability);
      merged.push(capability);
    }
  }
  return merged.length > 0 ? merged : undefined;
}

export function capabilitiesFromModelsDev(
  providerId: string,
  modelId: string,
  modalities: RawModalities,
  toolCall: boolean | undefined,
): readonly ModelCapability[] {
  const out: ModelCapability[] = [];
  const add = (capability: ModelCapability) => {
    if (!out.includes(capability)) out.push(capability);
  };
  const modalValues = [...(modalities?.input ?? []), ...(modalities?.output ?? [])];
  for (const modality of modalValues) {
    const capability = MODALITY_CAPABILITIES.get(modality.toLowerCase());
    if (capability) add(capability);
  }
  if (modalValues.length === 0) add('text');
  if (toolCall === true) add('tools');
  if (modelSupportsStreaming(providerId, modelId)) add('stream');
  return out;
}

export function modelSupportsStreaming(providerId: string, modelId: string): boolean {
  const provider = resolveProviderId(providerId);
  if (!STREAMING_ENDPOINT_PROVIDERS.has(provider)) return false;
  if (provider === 'openai' && isOpenAiNonStreamingModel(modelId)) return false;
  return true;
}

function resolveProviderId(providerId: string): string {
  const lower = providerId.toLowerCase();
  const entry = PROVIDER_BY_ID_OR_ALIAS.get(lower);
  return entry?.id ?? lower;
}

function isOpenAiNonStreamingModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.includes('image') ||
    lower.includes('tts') ||
    lower.includes('whisper') ||
    lower.includes('transcribe') ||
    lower.includes('embedding')
  );
}
