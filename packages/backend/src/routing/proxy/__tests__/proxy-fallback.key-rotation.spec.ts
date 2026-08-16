import { Repository } from 'typeorm';
import type { KeyRotationRule, ModelRoute } from 'manifest-shared';
import { ProxyFallbackService } from '../proxy-fallback.service';
import { ReasoningContentCache } from '../reasoning-content-cache';
import { ProviderKeyService } from '../../routing-core/provider-key.service';
import { CustomProvider } from '../../../entities/custom-provider.entity';
import { OpenaiOauthService } from '../../oauth/openai/openai-oauth.service';
import { MinimaxOauthService } from '../../oauth/minimax/minimax-oauth.service';
import { AnthropicOauthService } from '../../oauth/anthropic/anthropic-oauth.service';
import { GeminiOauthService } from '../../oauth/gemini/gemini-oauth.service';
import { KiroOauthService } from '../../oauth/kiro/kiro-oauth.service';
import { XaiOauthService } from '../../oauth/xai/xai-oauth.service';
import { ProviderClient } from '../provider-client';
import { CopilotTokenService } from '../copilot-token.service';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import { AgentModelParamsService } from '../../routing-core/agent-model-params.service';
import { ProviderParamSpecService } from '../../routing-core/provider-param-spec.service';
import { KeyRotationRuleService } from '../../routing-core/key-rotation-rule.service';
import {
  createKeyRotationState,
  markKeyLabelUsed,
  nextUnusedKeyLabel,
  type KeyRotationState,
} from '../key-rotation';

/**
 * Key rotation inside the fallback chain (`tryFallbacks`).
 *
 * When a rule exists for a chain model, the rule fully controls that slot's
 * key choice: unused labels are attempted in order for the SAME model, each
 * fallback-triggering failure advances to the next label (no extra chain
 * slot consumed), and exhaustion advances to the next chain model. Without a
 * rule (or when the per-request state is omitted) behavior is unchanged.
 */

describe('ProxyFallbackService.tryFallbacks — key rotation', () => {
  let service: ProxyFallbackService;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let providerClient: jest.Mocked<ProviderClient>;
  let keyRotationRules: { getRule: jest.Mock; list: jest.Mock };

  const body = { messages: [{ role: 'user', content: 'Hello' }], stream: false };

  const rule = (
    model: string | null,
    keyOrder: string[],
    provider = 'openai',
    scope: 'model' | 'provider' = 'model',
  ): KeyRotationRule => ({
    id: `rule-${model}`,
    agentId: 'agent-1',
    model,
    provider,
    scope,
    keyOrder,
  });

  const forward = (status: number) => ({
    response: new Response('boom', { status }),
    isGoogle: false,
    isAnthropic: false,
    isChatGpt: false,
  });

  const runFallbacks = (
    models: string[],
    routes: ModelRoute[] | null,
    state?: KeyRotationState,
    primaryModel = 'gpt-4o',
  ) =>
    service.tryFallbacks(
      'agent-1',
      'user-1',
      models,
      body,
      false,
      'sess-1',
      primaryModel,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      routes,
      undefined, // paramMergeContext
      undefined, // startProviderAttempt
      undefined, // credentialDashboardUrl
      undefined, // providerCacheKey
      state, // keyRotationState (last param)
    );

  beforeEach(() => {
    providerKeyService = {
      getProviderApiKey: jest.fn().mockResolvedValue('sk-test'),
      getProviderKeyId: jest.fn().mockResolvedValue('up-fallback'),
      getDefaultKeyLabel: jest.fn().mockResolvedValue(undefined),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
      findProviderForModel: jest.fn().mockResolvedValue(undefined),
      getProviderRegion: jest.fn().mockResolvedValue(null),
      hasActiveProvider: jest.fn().mockResolvedValue(true),
      // Label-aware selection: unknown labels resolve to nothing (simulates a
      // connection that was renamed/removed after the rule was written).
      selectProviderKey: jest.fn(
        async (
          _tenant: string,
          _provider: string,
          _authType?: string,
          label?: string,
          _agentId?: string,
        ) => {
          if (label && !['work', 'personal', 'live', 'pinned'].includes(label.toLowerCase())) {
            return null;
          }
          return {
            id: label ? `up-${label.toLowerCase()}` : 'up-default',
            label: label ?? 'Default',
            priority: 0,
            apiKey: 'sk-test',
            region: null,
          };
        },
      ),
    } as unknown as jest.Mocked<ProviderKeyService>;

    providerClient = {
      forward: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    keyRotationRules = {
      getRule: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue([]),
    };

    const customProviderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Repository<CustomProvider>>;

    const oauthStub = { unwrapToken: jest.fn().mockResolvedValue(null) };

    service = new ProxyFallbackService(
      providerKeyService,
      customProviderRepo,
      oauthStub as unknown as OpenaiOauthService,
      oauthStub as unknown as MinimaxOauthService,
      oauthStub as unknown as AnthropicOauthService,
      oauthStub as unknown as GeminiOauthService,
      oauthStub as unknown as KiroOauthService,
      oauthStub as unknown as XaiOauthService,
      providerClient,
      {
        getCopilotToken: jest.fn().mockResolvedValue('tid=copilot-session'),
      } as unknown as CopilotTokenService,
      {
        getByModel: jest.fn().mockReturnValue(null),
      } as unknown as ModelPricingCacheService,
      {
        get: jest.fn().mockResolvedValue(null),
        list: jest.fn().mockResolvedValue([]),
      } as unknown as AgentModelParamsService,
      {
        getSpecs: jest.fn().mockResolvedValue([]),
        list: jest.fn().mockResolvedValue([]),
      } as unknown as ProviderParamSpecService,
      new ReasoningContentCache(),
      keyRotationRules as unknown as KeyRotationRuleService,
    );
  });

  it('rotates to the next label on a failing attempt and succeeds (no chain slot consumed)', async () => {
    keyRotationRules.getRule.mockResolvedValue(rule('gpt-4o', ['Work', 'Personal']));
    providerClient.forward.mockResolvedValueOnce(forward(401)).mockResolvedValueOnce(forward(200));

    const result = await runFallbacks(
      ['gpt-4o'],
      [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o' }],
      createKeyRotationState(),
    );

    // Two attempts on the SAME chain slot (fallbackIndex 0), not two slots.
    expect(providerClient.forward).toHaveBeenCalledTimes(2);
    expect(providerClient.forward.mock.calls[0][0].authType).toBe('api_key');
    expect(result.success).not.toBeNull();
    expect(result.success!.fallbackIndex).toBe(0);
    expect(result.success!.model).toBe('gpt-4o');
    // The winning row is the second label's connection.
    expect(result.success!.keyLabel).toBe('Personal');
    expect(result.success!.tenantProviderId).toBe('up-personal');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].status).toBe(401);
  });

  it('exhausted labels advance the chain to the next model', async () => {
    keyRotationRules.getRule
      .mockResolvedValueOnce(rule('gpt-4o', ['Work', 'Personal']))
      .mockResolvedValueOnce(null);
    providerClient.forward
      .mockResolvedValueOnce(forward(500))
      .mockResolvedValueOnce(forward(500))
      .mockResolvedValueOnce(forward(200));

    const result = await runFallbacks(
      ['gpt-4o', 'claude-haiku-3.5'],
      [
        { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        { provider: 'anthropic', authType: 'api_key', model: 'claude-haiku-3.5' },
      ],
      createKeyRotationState(),
    );

    expect(providerClient.forward).toHaveBeenCalledTimes(3);
    expect(result.success).not.toBeNull();
    expect(result.success!.fallbackIndex).toBe(1);
    // Anthropic model ids are normalized to the short form at runtime.
    expect(result.success!.model).toBe('claude-haiku-3-5');
    expect(result.failures).toHaveLength(2);
    expect(result.failures.map((f) => f.model)).toEqual(['gpt-4o', 'gpt-4o']);
  });

  it('no rule → unchanged behavior (single pinned-label attempt)', async () => {
    keyRotationRules.getRule.mockResolvedValue(null);
    providerClient.forward.mockResolvedValue(forward(200));

    const result = await runFallbacks(
      ['gpt-4o'],
      [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o', keyLabel: 'Pinned' }],
      createKeyRotationState(),
    );

    expect(providerClient.forward).toHaveBeenCalledTimes(1);
    // Legacy path: the pinned route label controls the key.
    expect(result.success!.keyLabel).toBe('Pinned');
  });

  it('pinned route keyLabel wins over the rotation rule (only that key is tried)', async () => {
    keyRotationRules.getRule.mockResolvedValue(rule('gpt-4o', ['Work', 'Personal']));
    providerClient.forward.mockResolvedValue(forward(200));

    const result = await runFallbacks(
      ['gpt-4o'],
      [
        {
          provider: 'openai',
          authType: 'api_key',
          model: 'gpt-4o',
          keyLabel: 'Pinned',
        },
      ],
      createKeyRotationState(),
    );

    // The rule is never consulted for a pinned label — the pinned key is the
    // only one attempted.
    expect(keyRotationRules.getRule).not.toHaveBeenCalled();
    expect(providerClient.forward).toHaveBeenCalledTimes(1);
    expect(result.success!.keyLabel).toBe('Pinned');
  });

  it("keyLabel 'rotation' sentinel + rule → the rule's labels are used", async () => {
    keyRotationRules.getRule.mockResolvedValue(rule('gpt-4o', ['Work', 'Personal']));
    providerClient.forward.mockResolvedValueOnce(forward(401)).mockResolvedValueOnce(forward(200));

    const result = await runFallbacks(
      ['gpt-4o'],
      [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o', keyLabel: 'rotation' }],
      createKeyRotationState(),
    );

    // Sentinel opts into rotation: the rule's first label fails, the second
    // wins on the same chain slot.
    expect(providerClient.forward).toHaveBeenCalledTimes(2);
    expect(result.success).not.toBeNull();
    expect(result.success!.fallbackIndex).toBe(0);
    expect(result.success!.keyLabel).toBe('Personal');
    expect(result.success!.tenantProviderId).toBe('up-personal');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].status).toBe(401);
  });

  it("keyLabel 'rotation' sentinel + no rule → falls through to the default key", async () => {
    keyRotationRules.getRule.mockResolvedValue(null);
    providerClient.forward.mockResolvedValue(forward(200));

    const result = await runFallbacks(
      ['gpt-4o'],
      [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o', keyLabel: 'rotation' }],
      createKeyRotationState(),
    );

    // The sentinel resolves to no pin; with no rule, the default credential
    // (undefined label → default key row) is used.
    expect(providerClient.forward).toHaveBeenCalledTimes(1);
    expect(result.success).not.toBeNull();
    expect(result.success!.tenantProviderId).toBe('up-default');
    // The default row's own label is stamped on the success (same as any
    // unpinned fallback — the meta names the connection that served it).
    expect(result.success!.keyLabel).toBe('Default');
  });

  it('a provider-scope rule rotates labels for any model of that provider', async () => {
    keyRotationRules.getRule.mockResolvedValue(
      rule(null, ['Work', 'Personal'], 'openai', 'provider'),
    );
    providerClient.forward.mockResolvedValueOnce(forward(401)).mockResolvedValueOnce(forward(200));

    const result = await runFallbacks(
      ['gpt-4o'],
      [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o' }],
      createKeyRotationState(),
    );

    // The provider rule (no model identity) applies to the bare model.
    expect(providerClient.forward).toHaveBeenCalledTimes(2);
    expect(result.success).not.toBeNull();
    expect(result.success!.model).toBe('gpt-4o');
    expect(result.success!.keyLabel).toBe('Personal');
    expect(result.failures).toHaveLength(1);
  });

  it('skips unresolvable labels (recorded as credential failures) and tries the next', async () => {
    keyRotationRules.getRule.mockResolvedValue(rule('gpt-4o', ['Dead', 'Live']));
    providerClient.forward.mockResolvedValue(forward(200));

    const result = await runFallbacks(
      ['gpt-4o'],
      [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o' }],
      createKeyRotationState(),
    );

    // Only the resolvable label reached provider transport.
    expect(providerClient.forward).toHaveBeenCalledTimes(1);
    expect(result.success!.keyLabel).toBe('Live');
    // The unresolvable label is recorded as a credential-failure fallback.
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].status).toBe(401);
    expect(result.failures[0].model).toBe('gpt-4o');
  });

  it('labels already burned by the primary are not re-tried for the same model', async () => {
    keyRotationRules.getRule.mockResolvedValue(rule('gpt-4o', ['Work', 'Personal']));
    providerClient.forward.mockResolvedValue(forward(200));
    const state = createKeyRotationState();
    // Simulate the primary flow having exhausted both labels already.
    markKeyLabelUsed(state, rule('gpt-4o', ['Work', 'Personal']), 'gpt-4o', 'Work');
    markKeyLabelUsed(state, rule('gpt-4o', ['Work', 'Personal']), 'gpt-4o', 'Personal');

    const result = await runFallbacks(
      ['gpt-4o', 'claude-haiku-3.5'],
      [
        { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        { provider: 'anthropic', authType: 'api_key', model: 'claude-haiku-3.5' },
      ],
      state,
    );

    // The exhausted model's slot is skipped entirely; the chain advances.
    expect(providerClient.forward).toHaveBeenCalledTimes(1);
    expect(result.success!.model).toBe('claude-haiku-3-5');
    expect(result.success!.fallbackIndex).toBe(1);
  });

  it('a non-triggering status stops rotation and the chain (same break as today)', async () => {
    keyRotationRules.getRule.mockResolvedValue(rule('gpt-4o', ['Work', 'Personal']));
    // 399 is not ok and shouldTriggerFallback(399) is false.
    providerClient.forward.mockResolvedValue(forward(399));

    const result = await runFallbacks(
      ['gpt-4o', 'claude-haiku-3.5'],
      [
        { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        { provider: 'anthropic', authType: 'api_key', model: 'claude-haiku-3.5' },
      ],
      createKeyRotationState(),
    );

    expect(providerClient.forward).toHaveBeenCalledTimes(1);
    expect(result.success).toBeNull();
    expect(result.failures).toHaveLength(1);
  });

  it('marks recoveredByKeyRotation when the primary burned labels before this same-model slot ran', async () => {
    keyRotationRules.getRule.mockResolvedValue(rule('gpt-4o', ['Work', 'Personal']));
    providerClient.forward.mockResolvedValue(forward(200));
    const state = createKeyRotationState();
    // The primary (same model) already burned 'Work' on the credential path —
    // this slot's FIRST *unused* label is 'Personal' (filtered index 0).
    markKeyLabelUsed(state, rule('gpt-4o', ['Work', 'Personal']), 'gpt-4o', 'Work');

    const result = await runFallbacks(
      ['gpt-4o'],
      [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o' }],
      state,
    );

    expect(providerClient.forward).toHaveBeenCalledTimes(1);
    expect(result.success!.keyLabel).toBe('Personal');
    // usedLabelCount > 0 (Work burned by the primary) makes this a rotation
    // recovery even though the slot itself tried only its first unused label.
    expect(result.success!.recoveredByKeyRotation).toBe(true);
  });

  it('does not mark recoveredByKeyRotation for a different-model slot that rotates', async () => {
    keyRotationRules.getRule.mockResolvedValue(
      rule('claude-haiku-3.5', ['Work', 'Personal'], 'anthropic'),
    );
    providerClient.forward.mockResolvedValueOnce(forward(401)).mockResolvedValueOnce(forward(200));

    const result = await runFallbacks(
      ['claude-haiku-3.5'],
      [{ provider: 'anthropic', authType: 'api_key', model: 'claude-haiku-3.5' }],
      createKeyRotationState(),
    );

    expect(result.success!.keyLabel).toBe('Personal');
    expect(result.success!.recoveredByKeyRotation).toBe(false);
  });

  describe('nextUnusedKeyLabel', () => {
    it('returns the first label when nothing is used yet', () => {
      const state = createKeyRotationState();
      expect(nextUnusedKeyLabel(rule('gpt-4o', ['Work', 'Personal']), state, 'gpt-4o')).toBe(
        'Work',
      );
    });

    it('skips used labels in order', () => {
      const state = createKeyRotationState();
      markKeyLabelUsed(state, rule('gpt-4o', ['Work', 'Personal']), 'gpt-4o', 'Work');
      expect(nextUnusedKeyLabel(rule('gpt-4o', ['Work', 'Personal']), state, 'gpt-4o')).toBe(
        'Personal',
      );
    });

    it('returns undefined when the order is exhausted', () => {
      const state = createKeyRotationState();
      markKeyLabelUsed(state, rule('gpt-4o', ['Work', 'Personal']), 'gpt-4o', 'Work');
      markKeyLabelUsed(state, rule('gpt-4o', ['Work', 'Personal']), 'gpt-4o', 'Personal');
      expect(nextUnusedKeyLabel(rule('gpt-4o', ['Work', 'Personal']), state, 'gpt-4o')).toBe(
        undefined,
      );
    });

    it('provider-scope rules share state across models (failed label not retried)', () => {
      const providerRule = rule(null, ['Work', 'Personal'], 'openai', 'provider');
      const state = createKeyRotationState();
      // Model X hard-failed on 'Work' under the provider rule…
      markKeyLabelUsed(state, providerRule, 'gpt-4o', 'Work');
      // …so model Y of the same provider must NOT re-try 'Work'.
      expect(nextUnusedKeyLabel(providerRule, state, 'claude-sonnet-4-5')).toBe('Personal');
    });

    it('model-scope rules keep per-model state', () => {
      const modelRule = rule('gpt-4o', ['Work', 'Personal']);
      const state = createKeyRotationState();
      markKeyLabelUsed(state, modelRule, 'gpt-4o', 'Work');
      // A different model under a DIFFERENT model rule starts fresh.
      const otherRule = rule('claude-sonnet-4-5', ['Work', 'Personal'], 'anthropic');
      expect(nextUnusedKeyLabel(otherRule, state, 'claude-sonnet-4-5')).toBe('Work');
    });
  });
});
