import { PROVIDER_BY_ID_OR_ALIAS } from '../common/constants/providers';
import type { ModelCapability, ModelModality } from 'manifest-shared';

type RawModalities = { input?: string[]; output?: string[] } | undefined;

const DEFAULT_MODALITIES: readonly ModelModality[] = ['text'];

const MODALITY_CAPABILITIES: ReadonlyMap<string, ModelModality> = new Map([
  ['text', 'text'],
  ['image', 'image'],
  ['audio', 'audio'],
  ['video', 'video'],
]);

const STREAMING_ENDPOINT_PROVIDERS = new Set([
  'anthropic',
  'byteplus',
  'commandcode',
  'copilot',
  'deepseek',
  'fireworks',
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

export interface ModelModalities {
  input: readonly ModelModality[];
  output: readonly ModelModality[];
}

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

export function modelModalitiesFromModelsDev(modalities: RawModalities): ModelModalities {
  return {
    input: normalizeModalities(modalities?.input),
    output: normalizeModalities(modalities?.output),
  };
}

export function inputModalitiesFromCapabilities(
  capabilities: readonly ModelCapability[] | null | undefined,
): readonly ModelModality[] {
  const out: ModelModality[] = ['text'];
  for (const capability of capabilities ?? []) {
    if (capability === 'text' || capability === 'stream' || capability === 'tools') continue;
    if (!out.includes(capability)) out.push(capability);
  }
  return out;
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
  const normalized = modelModalitiesFromModelsDev(modalities);
  for (const modality of [...normalized.input, ...normalized.output]) add(modality);
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

function normalizeModalities(values: readonly string[] | undefined): readonly ModelModality[] {
  const out: ModelModality[] = [];
  for (const value of values ?? []) {
    const modality = MODALITY_CAPABILITIES.get(value.toLowerCase());
    if (modality && !out.includes(modality)) out.push(modality);
  }
  return out.length > 0 ? out : DEFAULT_MODALITIES;
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
