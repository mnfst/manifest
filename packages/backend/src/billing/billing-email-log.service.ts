import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

export interface BillingEmailLogParams {
  dedupeKey: string;
  kind: string;
  tenantId?: string | null;
  userId?: string | null;
  stripeSubscriptionId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class BillingEmailLogService {
  constructor(private readonly dataSource: DataSource) {}

  async tryInsert(params: BillingEmailLogParams): Promise<boolean> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO billing_email_logs
         (id, dedupe_key, kind, tenant_id, user_id, stripe_subscription_id, period_start, period_end, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [
        uuid(),
        params.dedupeKey,
        params.kind,
        params.tenantId ?? null,
        params.userId ?? null,
        params.stripeSubscriptionId ?? null,
        params.periodStart ?? null,
        params.periodEnd ?? null,
        params.metadata ?? null,
      ],
    );
    return rows.length > 0;
  }
}
