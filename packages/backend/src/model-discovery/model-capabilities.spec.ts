import {
  inputModalitiesFromCapabilities,
  resolveModelCapabilityMetadata,
} from './model-capabilities';
import type { DiscoveredModel } from './model-fetcher';
import type { ModelsDevModelEntry } from '../database/models-dev-sync.service';

function makeModel(overrides: Partial<DiscoveredModel> = {}): DiscoveredModel {
  return {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
    ...overrides,
  };
}

function makeModelsDevEntry(overrides: Partial<ModelsDevModelEntry> = {}): ModelsDevModelEntry {
  return {
    id: 'gpt-4o',
    name: 'GPT-4o',
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilities: ['text', 'image'],
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    ...overrides,
  };
}

describe('inputModalitiesFromCapabilities', () => {
  it('keeps text first and appends each novel capability once', () => {
    const out = inputModalitiesFromCapabilities([
      'text',
      'stream',
      'tools',
      'image',
      'image',
      'audio',
    ] as never);
    expect(out).toEqual(['text', 'image', 'audio']);
  });

  it('defaults to text-only for nullish capabilities', () => {
    expect(inputModalitiesFromCapabilities(null)).toEqual(['text']);
  });
});

describe('resolveModelCapabilityMetadata', () => {
  const paramSpecs = { getCapabilities: jest.fn() };
  const modelsDevSync = { lookupModel: jest.fn() };

  beforeEach(() => {
    paramSpecs.getCapabilities.mockReset().mockResolvedValue(null);
    modelsDevSync.lookupModel.mockReset().mockReturnValue(null);
  });

  it('merges discovery, models.dev, param-spec, and streaming-heuristic capabilities', async () => {
    paramSpecs.getCapabilities.mockResolvedValue(['tools']);
    modelsDevSync.lookupModel.mockReturnValue(makeModelsDevEntry());

    const resolved = await resolveModelCapabilityMetadata(
      makeModel({ capabilities: ['audio'], authType: 'subscription' }),
      paramSpecs,
      modelsDevSync,
    );

    expect(paramSpecs.getCapabilities).toHaveBeenCalledWith('openai', 'subscription', 'gpt-4o');
    expect(resolved.capabilities).toEqual(['audio', 'text', 'image', 'tools', 'stream']);
    expect(resolved.inputModalities).toEqual(['text', 'image']);
    expect(resolved.outputModalities).toEqual(['text']);
    expect(resolved.modelsDevEntry).not.toBeNull();
  });

  it('leaves everything undefined when no source knows the model', async () => {
    const resolved = await resolveModelCapabilityMetadata(
      makeModel({ id: 'mystery', provider: 'kiro' }),
      paramSpecs,
      modelsDevSync,
    );

    expect(paramSpecs.getCapabilities).toHaveBeenCalledWith('kiro', 'api_key', 'mystery');
    expect(resolved).toEqual({
      capabilities: undefined,
      inputModalities: undefined,
      outputModalities: undefined,
      modelsDevEntry: null,
    });
  });

  it('keeps discovery-time modalities when models.dev has no entry', async () => {
    const resolved = await resolveModelCapabilityMetadata(
      makeModel({
        id: 'mystery',
        provider: 'kiro',
        inputModalities: ['text'],
        outputModalities: ['text'],
      }),
      paramSpecs,
      modelsDevSync,
    );

    expect(resolved.inputModalities).toEqual(['text']);
    expect(resolved.outputModalities).toEqual(['text']);
  });

  it('falls back to curated known capability facts when discovery and models.dev are silent', async () => {
    const resolved = await resolveModelCapabilityMetadata(
      makeModel({ id: 'gpt-5.4-mini', provider: 'openai', authType: 'subscription' }),
      paramSpecs,
      modelsDevSync,
    );

    expect(resolved.inputModalities).toEqual(['text', 'image']);
    expect(resolved.outputModalities).toEqual(['text']);
    expect(resolved.capabilities).toEqual(['stream', 'text', 'image', 'tools']);
  });

  it('prefers discovered modalities over the curated known list', async () => {
    const resolved = await resolveModelCapabilityMetadata(
      makeModel({
        id: 'gpt-5.4-mini',
        provider: 'openai',
        inputModalities: ['text'],
        outputModalities: ['text'],
      }),
      paramSpecs,
      modelsDevSync,
    );

    expect(resolved.inputModalities).toEqual(['text']);
    expect(resolved.outputModalities).toEqual(['text']);
  });

  it('looks up metadata under the underlying provider for vendor-prefixed ids', async () => {
    await resolveModelCapabilityMetadata(
      makeModel({ id: 'anthropic.claude-sonnet-5-v1:0', provider: 'bedrock' }),
      paramSpecs,
      modelsDevSync,
    );

    expect(modelsDevSync.lookupModel).toHaveBeenCalledWith('anthropic', 'claude-sonnet-5-v1:0');
  });
});
