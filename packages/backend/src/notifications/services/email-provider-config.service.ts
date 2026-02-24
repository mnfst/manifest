import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { render } from '@react-email/render';
import { detectDialect, portableSql, type DbDialect } from '../../common/utils/sql-dialect';
import { validateProviderConfig } from './email-provider-validation';
import { createProvider } from './email-providers/resolve-provider';
import { TestEmail } from '../emails/test-email';
import type { EmailProviderConfig as ProviderConfig } from './email-providers/email-provider.interface';

export interface EmailProviderPublicConfig {
  provider: string;
  domain: string | null;
  keyPrefix: string;
  is_active: boolean;
  notificationEmail: string | null;
}

export interface EmailProviderFullConfig {
  provider: string;
  apiKey: string;
  domain: string | null;
  notificationEmail: string | null;
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
      this.sql(`SELECT provider, domain, api_key_encrypted, is_active, notification_email FROM email_provider_configs WHERE user_id = $1`),
      [userId],
    );
    if (!rows.length) return null;

    const row = rows[0];
    return {
      provider: row.provider,
      domain: row.domain ?? null,
      keyPrefix: row.api_key_encrypted.substring(0, 8),
      is_active: !!row.is_active,
      notificationEmail: row.notification_email ?? null,
    };
  }

  async upsert(
    userId: string,
    dto: { provider: string; apiKey?: string; domain?: string; notificationEmail?: string },
  ): Promise<EmailProviderPublicConfig> {
    const notificationEmail = dto.notificationEmail?.trim().toLowerCase() || null;
    const now = new Date().toISOString();

    const existing = await this.ds.query(
      this.sql(`SELECT id, api_key_encrypted FROM email_provider_configs WHERE user_id = $1`),
      [userId],
    );

    // When updating without a new API key, keep the existing one
    if (existing.length > 0 && !dto.apiKey) {
      const existingKey = existing[0].api_key_encrypted;
      const validation = validateProviderConfig(dto.provider, existingKey, dto.domain);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors);
      }
      const { domain, provider } = validation.normalized;

      await this.ds.query(
        this.sql(`UPDATE email_provider_configs SET provider = $1, domain = $2, is_active = $3, updated_at = $4, notification_email = $5 WHERE user_id = $6`),
        [provider, domain || null, 1, now, notificationEmail, userId],
      );

      return {
        provider,
        domain: domain || null,
        keyPrefix: existingKey.substring(0, 8),
        is_active: true,
        notificationEmail,
      };
    }

    // New key provided — validate and save
    if (!dto.apiKey) {
      throw new BadRequestException('API key is required for new configurations');
    }

    const validation = validateProviderConfig(dto.provider, dto.apiKey, dto.domain);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors);
    }

    const { apiKey, domain, provider } = validation.normalized;

    if (existing.length > 0) {
      await this.ds.query(
        this.sql(`UPDATE email_provider_configs SET provider = $1, api_key_encrypted = $2, domain = $3, is_active = $4, updated_at = $5, notification_email = $6 WHERE user_id = $7`),
        [provider, apiKey, domain || null, 1, now, notificationEmail, userId],
      );
    } else {
      await this.ds.query(
        this.sql(`INSERT INTO email_provider_configs (id, user_id, provider, api_key_encrypted, domain, is_active, created_at, updated_at, notification_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`),
        [uuid(), userId, provider, apiKey, domain || null, 1, now, now, notificationEmail],
      );
    }

    return {
      provider,
      domain: domain || null,
      keyPrefix: apiKey.substring(0, 8),
      is_active: true,
      notificationEmail,
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
      this.sql(`SELECT provider, api_key_encrypted, domain, notification_email FROM email_provider_configs WHERE user_id = $1 AND is_active = $2`),
      [userId, 1],
    );
    if (!rows.length) return null;

    const row = rows[0];
    return {
      provider: row.provider,
      apiKey: row.api_key_encrypted,
      domain: row.domain ?? null,
      notificationEmail: row.notification_email ?? null,
    };
  }

  async getNotificationEmail(userId: string): Promise<string | null> {
    const rows = await this.ds.query(
      this.sql(`SELECT notification_email FROM email_provider_configs WHERE user_id = $1`),
      [userId],
    );
    return rows[0]?.notification_email ?? null;
  }

  async setNotificationEmail(userId: string, email: string): Promise<void> {
    const existing = await this.ds.query(
      this.sql(`SELECT id FROM email_provider_configs WHERE user_id = $1`),
      [userId],
    );
    const now = new Date().toISOString();

    if (existing.length > 0) {
      await this.ds.query(
        this.sql(`UPDATE email_provider_configs SET notification_email = $1, updated_at = $2 WHERE user_id = $3`),
        [email.trim().toLowerCase(), now, userId],
      );
    }
  }

  async testSavedConfig(
    userId: string,
    toEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.getFullConfig(userId);
    if (!config) {
      return { success: false, error: 'No email provider configured' };
    }
    return this.testConfig(
      { provider: config.provider, apiKey: config.apiKey, domain: config.domain ?? undefined },
      toEmail,
    );
  }

  async testConfig(
    dto: { provider: string; apiKey: string; domain?: string },
    toEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const validation = validateProviderConfig(dto.provider, dto.apiKey, dto.domain);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const { provider, apiKey, domain } = validation.normalized;

    try {
      const config: ProviderConfig = {
        provider: provider as ProviderConfig['provider'],
        apiKey,
        domain: domain || undefined,
      };
      const emailProvider = createProvider(config);
      const html = await render(TestEmail());
      const text = await render(TestEmail(), { plainText: true });
      const from = domain
        ? `Manifest <noreply@${domain}>`
        : `Manifest <${process.env['NOTIFICATION_FROM_EMAIL'] ?? 'noreply@manifest.build'}>`;
      const sent = await emailProvider.send({
        to: toEmail,
        subject: 'Manifest — Test Email',
        html,
        text,
        from,
      });
      return sent ? { success: true } : { success: false, error: 'Provider returned failure' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
