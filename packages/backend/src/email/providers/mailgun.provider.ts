import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { EmailMessage, EmailSendResult } from '@manifest/shared';
import { EmailProvider } from './email-provider.interface';

/**
 * Mailgun email provider for production email sending.
 */
@Injectable()
export class MailgunProvider implements EmailProvider {
  private readonly logger = new Logger(MailgunProvider.name);
  private readonly client: ReturnType<Mailgun['client']> | null;
  private readonly domain: string;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MAILGUN_API_KEY');
    this.domain = this.configService.get<string>('MAILGUN_DOMAIN', '');
    const isEuRegion = this.configService.get<string>('MAILGUN_EU_REGION', 'false') === 'true';

    if (apiKey && this.domain) {
      const mailgun = new Mailgun(FormData);
      this.client = mailgun.client({
        username: 'api',
        key: apiKey,
        url: isEuRegion ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
      });
      this.configured = true;
      this.logger.log(`Mailgun provider configured for domain: ${this.domain}`);
    } else {
      this.client = null;
      this.configured = false;
      this.logger.warn('Mailgun provider not configured - missing API key or domain');
    }
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Mailgun provider not configured',
        timestamp: new Date(),
      };
    }

    try {
      const result = await this.client.messages.create(this.domain, {
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        'h:Reply-To': message.replyTo,
      });

      this.logger.log(`Email sent successfully to ${message.to}, messageId: ${result.id}`);

      return {
        success: true,
        messageId: result.id,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email to ${message.to}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getName(): string {
    return 'mailgun';
  }
}
