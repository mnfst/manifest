import { Logger } from '@nestjs/common';
import { EmailProvider, EmailProviderConfig, SendEmailOptions } from './email-provider.interface';

const logger = new Logger('SendGridProvider');

export class SendGridProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(config: EmailProviderConfig) {
    this.apiKey = config.apiKey;
    this.defaultFrom = config.fromEmail ?? 'noreply@manifest.build';
  }

  async send(opts: SendEmailOptions): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('SendGrid not configured — skipping email send');
      return false;
    }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: opts.to }] }],
          from: { email: this.parseFromEmail(opts.from) },
          subject: opts.subject,
          content: [
            ...(opts.text ? [{ type: 'text/plain', value: opts.text }] : []),
            { type: 'text/html', value: opts.html },
          ],
        }),
      });

      if (!res.ok) {
        logger.error(`SendGrid returned ${res.status}: ${await res.text()}`);
        return false;
      }

      logger.log(`Email sent to ${opts.to}: ${opts.subject}`);
      return true;
    } catch (err) {
      logger.error(`Failed to send email: ${err}`);
      return false;
    }
  }

  private parseFromEmail(from?: string): string {
    if (!from) return this.defaultFrom;
    const match = from.match(/<(.+)>/);
    return match ? match[1] : from;
  }
}
