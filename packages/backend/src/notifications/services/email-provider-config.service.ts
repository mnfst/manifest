import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { render } from '@react-email/render';
import { encrypt, decrypt, isEncrypted, getEncryptionSecret } from '../../common/utils/crypto.util';
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
  private readonly fromEmail: string;

  constructor(
    private readonly ds: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.fromEmail = this.configService.get<string>(
      'app.notificationFromEmail',
      'noreply@manifest.build',
    );
  }

  private decryptKey(stored: string): string {
    if (isEncrypted(stored)) {
      return decrypt(stored, getEncryptionSecret());
    }
    // Backwards compatibility: plaintext keys from before encryption was added
    return stored;
  }

  async getConfig(userId: string): Promise<EmailProviderPublicConfig | null> {
    const rows = await this.ds.query(
      `SELECT provider, domain, key_prefix, is_active, notification_email FROM email_provider_configs WHERE user_id = $1`,
      [userId],
    );
    if (!rows.length) return null;

    const row = rows[0];
    return {
      provider: row.provider,
      domain: row.domain ?? null,
      keyPrefix: row.key_prefix ?? '****',
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
      `SELECT id, api_key_encrypted FROM email_provider_configs WHERE user_id = $1`,
      [userId],
    );

    // When updating without a new API key, keep the existing one
    if (existing.length > 0 && !dto.apiKey) {
      const storedKey = existing[0].api_key_encrypted;
      const plainKey = this.decryptKey(storedKey);
      const validation = validateProviderConfig(dto.provider, plainKey, dto.domain);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors);
      }
      const { domain, provider } = validation.normalized;

      await this.ds.query(
        `UPDATE email_provider_configs SET provider = $1, domain = $2, is_active = $3, updated_at = $4, notification_email = $5 WHERE user_id = $6`,
        [provider, domain || null, 1, now, notificationEmail, userId],
      );

      return {
        provider,
        domain: domain || null,
        keyPrefix: existing[0].key_prefix ?? plainKey.substring(0, 8),
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
    const secret = getEncryptionSecret();
    const encryptedKey = encrypt(apiKey, secret);
    const prefix = apiKey.substring(0, 8);

    if (existing.length > 0) {
      await this.ds.query(
        `UPDATE email_provider_configs SET provider = $1, api_key_encrypted = $2, key_prefix = $3, domain = $4, is_active = $5, updated_at = $6, notification_email = $7 WHERE user_id = $8`,
        [provider, encryptedKey, prefix, domain || null, 1, now, notificationEmail, userId],
      );
    } else {
      await this.ds.query(
        `INSERT INTO email_provider_configs (id, user_id, provider, api_key_encrypted, key_prefix, domain, is_active, created_at, updated_at, notification_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuid(),
          userId,
          provider,
          encryptedKey,
          prefix,
          domain || null,
          1,
          now,
          now,
          notificationEmail,
        ],
      );
    }

    return {
      provider,
      domain: domain || null,
      keyPrefix: prefix,
      is_active: true,
      notificationEmail,
    };
  }

  async remove(userId: string): Promise<void> {
    await this.ds.query(`DELETE FROM email_provider_configs WHERE user_id = $1`, [userId]);
  }

  async getFullConfig(userId: string): Promise<EmailProviderFullConfig | null> {
    const rows = await this.ds.query(
      `SELECT provider, api_key_encrypted, domain, notification_email FROM email_provider_configs WHERE user_id = $1 AND is_active = $2`,
      [userId, 1],
    );
    if (!rows.length) return null;

    const row = rows[0];
    return {
      provider: row.provider,
      apiKey: this.decryptKey(row.api_key_encrypted),
      domain: row.domain ?? null,
      notificationEmail: row.notification_email ?? null,
    };
  }

  async getNotificationEmail(userId: string): Promise<string | null> {
    const rows = await this.ds.query(
      `SELECT notification_email FROM email_provider_configs WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.notification_email ?? null;
  }

  async setNotificationEmail(userId: string, email: string): Promise<void> {
    const existing = await this.ds.query(
      `SELECT id FROM email_provider_configs WHERE user_id = $1`,
      [userId],
    );
    const now = new Date().toISOString();

    if (existing.length > 0) {
      await this.ds.query(
        `UPDATE email_provider_configs SET notification_email = $1, updated_at = $2 WHERE user_id = $3`,
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
      const from = domain ? `Manifest <noreply@${domain}>` : `Manifest <${this.fromEmail}>`;
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
