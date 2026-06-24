import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  applyOperations,
  isKnownOperationType,
  type HealRequest,
  type HealResponse,
  type StructuralMessage,
} from 'manifest-healing-engine';
import { AgentHealingEnabled } from '../entities/agent-healing-enabled.entity';

/** Context the proxy hands to the healer on a request-side 4xx. */
export interface HealAttemptContext {
  requestId: string;
  tenantId: string;
  agentId: string;
  provider: string;
  model: string;
  body: Record<string, unknown>;
  errorStatus: number;
  errorBodyText: string;
}

/** Returned on a successful heal: the rewritten body + a token for the outcome report. */
export interface HealedRequest {
  body: Record<string, unknown>;
  token: HealOutcomeToken;
}

export interface HealOutcomeToken {
  requestId: string;
  patchRef: string;
  issueRef: string;
  tenantId: string;
  agentId: string;
}

const NON_PARAM_KEYS = new Set(['model', 'messages', 'tools', 'stream']);

/**
 * Advisory healing client. On a request-side 4xx the proxy asks the external
 * Healing service for catalog operations, applies them locally (via the shared
 * engine), and the proxy retries the same provider. The brain never receives
 * provider credentials or prompt content — only a structural request + the error.
 *
 * Every failure mode (not configured, timeout, non-2xx, bad payload, unknown op)
 * returns null/no-ops so healing can NEVER make the original failure worse.
 */
@Injectable()
export class HealingService {
  private readonly logger = new Logger(HealingService.name);

  constructor(
    @InjectRepository(AgentHealingEnabled)
    private readonly enabledRepo: Repository<AgentHealingEnabled>,
    private readonly config: ConfigService,
  ) {}

  /** True once a Healing service URL is configured. */
  get configured(): boolean {
    return Boolean(this.apiUrl);
  }

  /** Request-side 4xx the healer can attempt (429 is a rate limit, not request-side). */
  isCandidateStatus(status: number): boolean {
    return status >= 400 && status < 500 && status !== 429;
  }

  /** Per-agent activation: a row exists iff healing is enabled for the agent. */
  async isEnabled(agentId: string): Promise<boolean> {
    const count = await this.enabledRepo.count({ where: { agent_id: agentId } });
    return count > 0;
  }

  /**
   * Attempt to heal. Returns the rewritten body + an outcome token, or null if
   * there is nothing to apply (or anything went wrong). Never throws.
   */
  async tryHeal(ctx: HealAttemptContext): Promise<HealedRequest | null> {
    if (!this.configured) return null;
    try {
      const response = await this.callHeal(this.buildRequest(ctx));
      if (!response || response.outcome !== 'patch') return null;
      if (!response.operations.every((op) => isKnownOperationType((op as { type: string }).type))) {
        this.logger.warn('Healing returned an unknown operation type; skipping.');
        return null;
      }
      const { body } = applyOperations(ctx.body, response.operations);
      return {
        body,
        token: {
          requestId: ctx.requestId,
          patchRef: response.patchRef,
          issueRef: response.issueRef,
          tenantId: ctx.tenantId,
          agentId: ctx.agentId,
        },
      };
    } catch (err) {
      this.logger.warn(`Healing attempt failed: ${String(err)}`);
      return null;
    }
  }

  /** Report whether the retry under the patch succeeded (metering + learning). Never throws. */
  async reportOutcome(token: HealOutcomeToken, outcome: 'healed' | 'failed'): Promise<void> {
    if (!this.configured) return;
    try {
      await fetch(`${this.apiUrl}/heal/outcome`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          requestId: token.requestId,
          patchRef: token.patchRef,
          issueRef: token.issueRef,
          tenantId: token.tenantId,
          agentId: token.agentId,
          outcome,
          mode: 'post_error',
        }),
      });
    } catch (err) {
      this.logger.warn(`Healing outcome report failed: ${String(err)}`);
    }
  }

  private get apiUrl(): string {
    return this.config.get<string>('app.healingApiUrl') ?? '';
  }

  private get apiToken(): string {
    return this.config.get<string>('app.healingApiToken') ?? '';
  }

  private get timeoutMs(): number {
    return Number(this.config.get<number>('app.healingTimeoutMs') ?? 3000);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiToken) headers.authorization = `Bearer ${this.apiToken}`;
    return headers;
  }

  private async callHeal(request: HealRequest): Promise<HealResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.apiUrl}/heal`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as HealResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildRequest(ctx: HealAttemptContext): HealRequest {
    return {
      requestId: ctx.requestId,
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      request: {
        provider: ctx.provider,
        model: ctx.model,
        params: this.extractParams(ctx.body),
        tools: this.extractTools(ctx.body),
        messages: this.extractMessages(ctx.body),
      },
      error: this.parseError(ctx.errorStatus, ctx.errorBodyText),
      maxWaitMs: this.timeoutMs,
    };
  }

  /** Sampling/limit params only (not prompt content). */
  private extractParams(body: Record<string, unknown>): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!NON_PARAM_KEYS.has(k)) params[k] = v;
    }
    return params;
  }

  /** Tool JSON-schema structure with human-readable `description`s stripped. */
  private extractTools(body: Record<string, unknown>): Array<Record<string, unknown>> | undefined {
    if (!Array.isArray(body.tools)) return undefined;
    return (body.tools as unknown[]).map((t) => stripDescriptions(t) as Record<string, unknown>);
  }

  /** Messages reduced to role + byte size — never content. */
  private extractMessages(body: Record<string, unknown>): StructuralMessage[] {
    if (!Array.isArray(body.messages)) return [];
    return (body.messages as Array<Record<string, unknown>>).map((m) => ({
      role: typeof m.role === 'string' ? m.role : 'unknown',
      bytes: JSON.stringify(m.content ?? '').length,
    }));
  }

  private parseError(statusCode: number, text: string): HealRequest['error'] {
    try {
      const parsed = JSON.parse(text) as { error?: Record<string, unknown> } & Record<
        string,
        unknown
      >;
      const e = (parsed.error ?? parsed) as Record<string, unknown>;
      return {
        statusCode,
        type: typeof e.type === 'string' ? e.type : null,
        code: typeof e.code === 'string' ? e.code : null,
        param: typeof e.param === 'string' ? e.param : null,
        message: typeof e.message === 'string' ? e.message : text.slice(0, 500),
      };
    } catch {
      return { statusCode, type: null, code: null, param: null, message: text.slice(0, 500) };
    }
  }
}

/** Recursively remove `description` keys from a tool schema (developer text). */
function stripDescriptions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripDescriptions);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'description') continue;
      out[k] = stripDescriptions(v);
    }
    return out;
  }
  return node;
}
