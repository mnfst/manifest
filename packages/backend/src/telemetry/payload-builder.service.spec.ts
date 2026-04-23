import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent } from '../entities/agent.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { PayloadBuilderService } from './payload-builder.service';

interface ProviderRow {
  provider: string | null;
  count: string;
}
interface BucketRow {
  bucket: string | null;
  count: string;
}
interface TotalsRow {
  total: string;
  input_tokens: string | null;
  output_tokens: string | null;
}

interface MockData {
  providers: ProviderRow[];
  tiers: BucketRow[];
  authTypes: BucketRow[];
  totals: TotalsRow | undefined;
  agentPlatforms: BucketRow[];
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

  it('returns agents_by_platform grouped by agent_platform', async () => {
    const service = await makeService({
      agentPlatforms: [
        { bucket: 'openclaw', count: '3' },
        { bucket: 'hermes', count: '1' },
      ],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.agents_by_platform).toEqual({ openclaw: 3, hermes: 1 });
  });

  it('buckets NULL agent_platform rows under "unknown"', async () => {
    const service = await makeService({
      agentPlatforms: [{ bucket: null, count: '2' }],
    });

    const payload = await service.build('inst', '1.0.0');

    expect(payload.agents_by_platform).toEqual({ unknown: 2 });
  });
});
