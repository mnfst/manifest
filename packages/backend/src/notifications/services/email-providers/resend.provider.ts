import { EmailProvider, EmailProviderConfig, SendEmailOptions } from './email-provider.interface';

const logger = {
  warn: (msg: string) => console.warn(`[Resend] ${msg}`),
  error: (msg: string) => console.error(`[Resend] ${msg}`),
  log: (msg: string) => console.log(`[Resend] ${msg}`),
};

export class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(config: EmailProviderConfig) {
    this.apiKey = config.apiKey;
    this.defaultFrom = config.fromEmail ?? 'noreply@manifest.build';
  }

  async send(opts: SendEmailOptions): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('Resend not configured — skipping email send');
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: opts.from ?? `Manifest <${this.defaultFrom}>`,
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
          ...(opts.text ? { text: opts.text } : {}),
        }),
      });

      if (!res.ok) {
        logger.error(`Resend returned ${res.status}: ${await res.text()}`);
        return false;
      }

      logger.log(`Email sent to ${opts.to}: ${opts.subject}`);
      return true;
    } catch (err) {
      logger.error(`Failed to send email: ${err}`);
      return false;
    }
  }
}
