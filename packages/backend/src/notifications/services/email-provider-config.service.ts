import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { detectDialect, portableSql, type DbDialect } from '../../common/utils/sql-dialect';

export interface EmailProviderPublicConfig {
  provider: string;
  domain: string;
  keyPrefix: string;
  is_active: boolean;
}

export interface EmailProviderFullConfig {
  provider: string;
  apiKey: string;
  domain: string;
}

@Injectable()
export class EmailProviderConfigService {
  private readonly dialect: DbDialect;

  constructor(private readonly ds: DataSource) {
    this.dialect = detectDialect(ds.options.type as string);
  }

  private sql(query: string): string {
    return portableSql(query, this.dialect);
  }

  async getConfig(userId: string): Promise<EmailProviderPublicConfig | null> {
    const rows = await this.ds.query(
      this.sql(`SELECT provider, domain, api_key_encrypted, is_active FROM email_provider_configs WHERE user_id = $1`),
      [userId],
    );
    if (!rows.length) return null;

    const row = rows[0];
    return {
      provider: row.provider,
      domain: row.domain,
      keyPrefix: row.api_key_encrypted.substring(0, 8),
      is_active: !!row.is_active,
    };
  }

  async upsert(userId: string, dto: { provider: string; apiKey: string; domain: string }): Promise<EmailProviderPublicConfig> {
    const existing = await this.ds.query(
      this.sql(`SELECT id FROM email_provider_configs WHERE user_id = $1`),
      [userId],
    );

    const now = new Date().toISOString();

    if (existing.length > 0) {
      await this.ds.query(
        this.sql(`UPDATE email_provider_configs SET provider = $1, api_key_encrypted = $2, domain = $3, is_active = $4, updated_at = $5 WHERE user_id = $6`),
        [dto.provider, dto.apiKey, dto.domain, 1, now, userId],
      );
    } else {
      await this.ds.query(
        this.sql(`INSERT INTO email_provider_configs (id, user_id, provider, api_key_encrypted, domain, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`),
        [uuid(), userId, dto.provider, dto.apiKey, dto.domain, 1, now, now],
      );
    }

    return {
      provider: dto.provider,
      domain: dto.domain,
      keyPrefix: dto.apiKey.substring(0, 8),
      is_active: true,
    };
  }

  async remove(userId: string): Promise<void> {
    await this.ds.query(
      this.sql(`DELETE FROM email_provider_configs WHERE user_id = $1`),
      [userId],
    );
  }

  async getFullConfig(userId: string): Promise<EmailProviderFullConfig | null> {
    const rows = await this.ds.query(
      this.sql(`SELECT provider, api_key_encrypted, domain FROM email_provider_configs WHERE user_id = $1 AND is_active = $2`),
      [userId, 1],
    );
    if (!rows.length) return null;

    const row = rows[0];
    return {
      provider: row.provider,
      apiKey: row.api_key_encrypted,
      domain: row.domain,
    };
  }
}
