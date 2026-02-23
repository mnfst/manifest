import { Injectable, BadRequestException } from '@nestjs/common';
import { render } from '@react-email/render';
import {
  readLocalEmailConfig,
  writeLocalEmailConfig,
  clearLocalEmailConfig,
} from '../../common/constants/local-mode.constants';
import { EmailProviderConfig } from './email-providers/email-provider.interface';
import { createProvider } from './email-providers/resolve-provider';
import { TestEmail } from '../emails/test-email';

@Injectable()
export class EmailConfigService {
  private readonly isLocal = process.env['MANIFEST_MODE'] === 'local';

  getConfig(): { configured: boolean; provider?: string; domain?: string; fromEmail?: string } {
    if (!this.isLocal) {
      const hasMailgun = !!(process.env['MAILGUN_API_KEY'] && process.env['MAILGUN_DOMAIN']);
      return {
        configured: hasMailgun,
        provider: hasMailgun ? 'mailgun' : undefined,
        domain: hasMailgun ? process.env['MAILGUN_DOMAIN'] : undefined,
        fromEmail: process.env['NOTIFICATION_FROM_EMAIL'],
      };
    }

    const config = readLocalEmailConfig();
    if (!config) return { configured: false };

    return {
      configured: true,
      provider: config.provider,
      domain: config.domain,
      fromEmail: config.fromEmail,
    };
  }

  saveConfig(dto: { provider: string; apiKey: string; domain?: string; fromEmail?: string }): void {
    if (!this.isLocal) {
      throw new BadRequestException('Email config is managed via environment variables in cloud mode');
    }

    const config: EmailProviderConfig = {
      provider: dto.provider as EmailProviderConfig['provider'],
      apiKey: dto.apiKey,
      domain: dto.domain,
      fromEmail: dto.fromEmail,
    };
    writeLocalEmailConfig(config);
  }

  async testConfig(
    dto: { provider: string; apiKey: string; domain?: string; fromEmail?: string },
    toEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    let apiKey = dto.apiKey;
    if (!apiKey && this.isLocal) {
      const saved = readLocalEmailConfig();
      if (saved) apiKey = saved.apiKey;
    }
    if (!apiKey && !this.isLocal) {
      apiKey = process.env['MAILGUN_API_KEY'] ?? '';
    }

    const config: EmailProviderConfig = {
      provider: dto.provider as EmailProviderConfig['provider'],
      apiKey,
      domain: dto.domain,
      fromEmail: dto.fromEmail,
    };

    try {
      const provider = createProvider(config);
      const html = await render(TestEmail());
      const text = await render(TestEmail(), { plainText: true });
      const sent = await provider.send({
        to: toEmail,
        subject: 'Manifest — Test Email',
        html,
        text,
      });
      return sent ? { success: true } : { success: false, error: 'Provider returned failure' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  clearConfig(): void {
    if (!this.isLocal) {
      throw new BadRequestException('Email config is managed via environment variables in cloud mode');
    }
    clearLocalEmailConfig();
  }
}
