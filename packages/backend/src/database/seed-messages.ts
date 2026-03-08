import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { AgentMessage } from '../entities/agent-message.entity';

interface SeedContext {
  tenantId: string;
  agentId: string;
  agentName: string;
}

/** Deterministic pseudo-random for reproducible seed data */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export async function seedAgentMessages(
  messageRepo: Repository<AgentMessage>,
  userId: string,
  logger: Logger,
  ctx: SeedContext = {
    tenantId: 'seed-tenant-001',
    agentId: 'seed-agent-001',
    agentName: 'demo-agent',
  },
): Promise<void> {
  const count = await messageRepo.count();
  if (count > 0) return;

  const models: { name: string; auth_type: 'subscription' | 'api_key' }[] = [
    { name: 'claude-sonnet-4-5-20250929', auth_type: 'subscription' },
    { name: 'gpt-4o', auth_type: 'api_key' },
    { name: 'claude-haiku-4-5-20251001', auth_type: 'subscription' },
    { name: 'gemini-2.5-flash', auth_type: 'api_key' },
  ];
  const now = Date.now();
  const messages: Array<Partial<AgentMessage>> = [];
  let idx = 0;

  // Generate ~4-8 messages per hour over the last 7 days (168 hours)
  for (let h = 168; h >= 0; h--) {
    const hourBase = now - h * 3600000;
    // Fewer messages at night (hours 0-7 UTC), more during work hours
    const utcHour = new Date(hourBase).getUTCHours();
    const msgCount =
      utcHour >= 8 && utcHour <= 22
        ? 4 + Math.floor(seededRandom(h) * 5)
        : Math.floor(seededRandom(h + 500) * 3);

    for (let m = 0; m < msgCount; m++) {
      idx++;
      const entry = models[idx % models.length]!;
      const rawTs = hourBase + Math.floor(seededRandom(idx) * 3500000);
      const ts = new Date(Math.min(rawTs, now)).toISOString();

      // Input tokens 5-25x larger than output (realistic for LLM usage)
      const inputBase = 800 + Math.floor(seededRandom(idx * 3) * 14000);
      const outputBase = 60 + Math.floor(seededRandom(idx * 7) * 1200);
      const cacheRead = Math.floor(seededRandom(idx * 11) * inputBase * 0.4);

      messages.push({
        id: `seed-msg-${String(idx).padStart(4, '0')}`,
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        user_id: userId,
        agent_name: ctx.agentName,
        timestamp: ts,
        model: entry.name,
        auth_type: entry.auth_type,
        input_tokens: inputBase,
        output_tokens: outputBase,
        cache_read_tokens: cacheRead,
        cache_creation_tokens: 0,
        cost_usd:
          entry.auth_type === 'subscription' ? 0 : inputBase * 0.000003 + outputBase * 0.000015,
        duration_ms: 200 + Math.floor(seededRandom(idx * 13) * 4800),
        status: seededRandom(idx * 17) > 0.95 ? 'error' : 'ok',
        error_message: seededRandom(idx * 17) > 0.95 ? 'Rate limit exceeded' : null,
        session_key: `sess-${String((idx % 40) + 1).padStart(3, '0')}`,
      });
    }
  }

  // Bulk insert in batches of 100
  for (let i = 0; i < messages.length; i += 100) {
    await messageRepo.insert(messages.slice(i, i + 100));
  }
  logger.log(`Seeded ${messages.length} agent messages`);
}
