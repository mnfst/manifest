import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent } from '../entities/agent.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { PayloadBuilderService } from './payload-builder.service';

interface ProviderRow {
  provider: string | null;
  count: string;
  cost?: string | null;
}
interface BucketRow {
  bucket: string | null;
  count: string;
}
interface CategoryPlatformRow {
  category: string | null;
  platform: string | null;
  count: string;
}
interface TotalsRow {
  total: string;
  input_tokens: string | null;
  output_tokens: string | null;
  cost?: string | null;
}

interface MockData {
  providers: ProviderRow[];
  tiers: BucketRow[];
  authTypes: BucketRow[];
  totals: TotalsRow | undefined;
  agentPlatforms: CategoryPlatformRow[];
  agentsCount: number;
}

function defaultData(): MockData {
  return {
    providers: [],
    tiers: [],
    authTypes: [],
    totals: { total: '0', input_tokens: '0', output_tokens: '0' },
    agentPlatforms: [],
    agentsCount: 0,
  };
}

async function makeService(partial: Partial<MockData>): Promise<PayloadBuilderService> {
  const data: MockData = { ...defaultData(), ...partial };

  const messagesQueue = [
    { rows: data.providers, mode: 'getRawMany' as const },
    { rows: data.tiers, mode: 'getRawMany' as const },
    { rows: data.authTypes, mode: 'getRawMany' as const },
    { row: data.totals, mode: 'getRawOne' as const },
  ];
  const agentsQueue = [{ rows: data.agentPlatforms, mode: 'getRawMany' as const }];

  function makeQb(entry: { rows?: unknown; row?: unknown; mode: 'getRawMany' | 'getRawOne' }) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(entry.rows ?? []),
      getRawOne: jest.fn().mockResolvedValue(entry.row),
    };
  }

  const messagesRepo = {
    createQueryBuilder: jest.fn(() => makeQb(messagesQueue.shift()!)),
  };
  const agentsRepo = {
    createQueryBuilder: jest.fn(() => makeQb(agentsQueue.shift()!)),
    count: jest.fn().mockResolvedValue(data.agentsCount),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PayloadBuilderService,
      { provide: getRepositoryToken(AgentMessage), useValue: messagesRepo },
      { provide: getRepositoryToken(Agent), useValue: agentsRepo },
    ],
  }).compile();

  return module.get(PayloadBuilderService);
}

describe('PayloadBuilderService', () => {
  it('builds a payload with the full v1 shape', async () => {
    const service = await makeService({
      providers: [{ provider: 'anthropic', count: '3' }],
      totals: { total: '3', input_tokens: '100', output_tokens: '50' },
      agentsCount: 2,
    });

    const payload = await service.build('inst-123', '5.47.0');

    expect(payload.schema_version).toBe(1);
    expect(payload.install_id).toBe('inst-123');
    expect(payload.manifest_version).toBe('5.47.0');
    expect(payload.platform).toBe(process.platform);
    expect(payload.arch).toBe(process.arch);
  });

  it('aggregates message counts and token totals across the 24h window', async () => {
    const service = await makeService({
      providers: [
        { provider: 'anthropic', count: '10' },
        { provider: 'openai', count: '5' },
      ],
      totals: { total: '15', input_tokens: '1200', output_tokens: '800' },
      agentsCount: 4,
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_total).toBe(15);
    expect(payload.tokens_input_total).toBe(1200);
    expect(payload.tokens_output_total).toBe(800);
    expect(payload.agents_total).toBe(4);
    expect(payload.messages_by_provider).toEqual({ anthropic: 10, openai: 5 });
  });

  it('collapses unknown provider names to "custom" to prevent leakage', async () => {
    const service = await makeService({
      providers: [
        { provider: 'anthropic', count: '2' },
        { provider: 'my-self-hosted-vllm', count: '4' },
        { provider: 'another-custom', count: '1' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_by_provider).toEqual({ anthropic: 2, custom: 5 });
  });

  it('maps NULL providers to an "unknown" bucket', async () => {
    const service = await makeService({ providers: [{ provider: null, count: '2' }] });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_by_provider).toEqual({ unknown: 2 });
  });

  it('respects provider registry aliases (e.g. "google" → "gemini")', async () => {
    const service = await makeService({
      providers: [{ provider: 'google', count: '3' }],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(Object.keys(payload.messages_by_provider)).toContain('gemini');
  });

  it('treats missing token sums as zero', async () => {
    const service = await makeService({
      totals: { total: '0', input_tokens: null, output_tokens: null },
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.tokens_input_total).toBe(0);
    expect(payload.tokens_output_total).toBe(0);
    expect(payload.messages_total).toBe(0);
  });

  it('defaults totals to zero when the query returns undefined', async () => {
    const service = await makeService({ totals: undefined });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_total).toBe(0);
    expect(payload.tokens_input_total).toBe(0);
    expect(payload.tokens_output_total).toBe(0);
  });

  it('emits cost_usd_total = 0 and cost_usd_by_provider = {} when no cost data', async () => {
    const service = await makeService({
      providers: [{ provider: 'anthropic', count: '3' }],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.cost_usd_total).toBe(0);
    expect(payload.cost_usd_by_provider).toEqual({});
  });

  it('sums cost_usd_total from totals.cost and rounds to cents', async () => {
    const service = await makeService({
      totals: {
        total: '10',
        input_tokens: '0',
        output_tokens: '0',
        cost: '12.345678',
      },
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.cost_usd_total).toBe(12.35);
  });

  it('buckets cost_usd_by_provider with the same canonicalization as messages', async () => {
    const service = await makeService({
      providers: [
        { provider: 'anthropic', count: '10', cost: '5.4321' },
        { provider: 'openai', count: '5', cost: '2.1' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.cost_usd_by_provider).toEqual({ anthropic: 5.43, openai: 2.1 });
  });

  it('collapses custom provider costs into a single "custom" bucket', async () => {
    const service = await makeService({
      providers: [
        { provider: 'anthropic', count: '2', cost: '1.00' },
        { provider: 'my-self-hosted-vllm', count: '4', cost: '0.50' },
        { provider: 'another-custom', count: '1', cost: '0.25' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.cost_usd_by_provider).toEqual({ anthropic: 1, custom: 0.75 });
  });

  it('skips zero and null costs from cost_usd_by_provider', async () => {
    const service = await makeService({
      providers: [
        { provider: 'ollama', count: '100', cost: '0' },
        { provider: 'anthropic', count: '3', cost: '1.50' },
        { provider: 'openai', count: '1', cost: null },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.cost_usd_by_provider).toEqual({ anthropic: 1.5 });
  });

  it('drops cost_usd_by_provider buckets that round to 0 after rounding', async () => {
    const service = await makeService({
      providers: [{ provider: 'anthropic', count: '1', cost: '0.001' }],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.cost_usd_by_provider).toEqual({});
  });

  it('returns messages_by_tier grouped across the 4 canonical tiers', async () => {
    const service = await makeService({
      tiers: [
        { bucket: 'simple', count: '80' },
        { bucket: 'standard', count: '40' },
        { bucket: 'complex', count: '7' },
        { bucket: 'reasoning', count: '3' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_by_tier).toEqual({
      simple: 80,
      standard: 40,
      complex: 7,
      reasoning: 3,
    });
  });

  it('returns messages_by_auth_type grouped by api_key vs subscription', async () => {
    const service = await makeService({
      authTypes: [
        { bucket: 'api_key', count: '100' },
        { bucket: 'subscription', count: '20' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_by_auth_type).toEqual({ api_key: 100, subscription: 20 });
  });

  it('buckets NULL routing_tier rows under "unknown"', async () => {
    const service = await makeService({
      tiers: [
        { bucket: null, count: '5' },
        { bucket: 'simple', count: '10' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_by_tier).toEqual({ unknown: 5, simple: 10 });
  });

  it('collapses unknown routing_tier strings to "other" so a future write path cannot leak verbatim values', async () => {
    // Defense-in-depth: if some caller writes "warp-speed" into routing_tier,
    // the whitelist clamps it to "other" before it leaves the install.
    const service = await makeService({
      tiers: [
        { bucket: 'simple', count: '4' },
        { bucket: 'warp-speed', count: '6' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.messages_by_tier).toEqual({ simple: 4, other: 6 });
  });

  it('returns agents_by_platform grouped by agent_platform with bare keys for known platforms', async () => {
    const service = await makeService({
      agentPlatforms: [
        { category: 'personal', platform: 'openclaw', count: '3' },
        { category: 'personal', platform: 'hermes', count: '1' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.agents_by_platform).toEqual({ openclaw: 3, hermes: 1 });
  });

  it('emits composite "<category>:other" keys so peacock can tell the three Other variants apart', async () => {
    const service = await makeService({
      agentPlatforms: [
        { category: 'personal', platform: 'other', count: '5' },
        { category: 'app', platform: 'other', count: '2' },
        { category: 'coding', platform: 'other', count: '1' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.agents_by_platform).toEqual({
      'personal:other': 5,
      'app:other': 2,
      'coding:other': 1,
    });
  });

  it('mixes bare and composite keys in the same payload (known platforms stay bare)', async () => {
    const service = await makeService({
      agentPlatforms: [
        { category: 'personal', platform: 'openclaw', count: '4' },
        { category: 'coding', platform: 'claude-code', count: '2' },
        { category: 'personal', platform: 'other', count: '3' },
        { category: 'coding', platform: 'other', count: '1' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.agents_by_platform).toEqual({
      openclaw: 4,
      'claude-code': 2,
      'personal:other': 3,
      'coding:other': 1,
    });
  });

  it('falls back to bare "other" when the row has no category (legacy un-migrated rows)', async () => {
    const service = await makeService({
      agentPlatforms: [{ category: null, platform: 'other', count: '7' }],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.agents_by_platform).toEqual({ other: 7 });
  });

  it('buckets NULL agent_platform rows under "unknown"', async () => {
    const service = await makeService({
      agentPlatforms: [{ category: 'personal', platform: null, count: '2' }],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.agents_by_platform).toEqual({ unknown: 2 });
  });
});
