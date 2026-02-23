import { EmailProvider, EmailProviderConfig, SendEmailOptions } from './email-provider.interface';

const MAILGUN_BASE = 'https://api.mailgun.net';
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const logger = {
  warn: (msg: string) => console.warn(`[Mailgun] ${msg}`),
  error: (msg: string) => console.error(`[Mailgun] ${msg}`),
  log: (msg: string) => console.log(`[Mailgun] ${msg}`),
};

export class MailgunProvider implements EmailProvider {
  readonly name = 'mailgun';
  private readonly apiKey: string;
  private readonly domain: string;
  private readonly defaultFrom: string;

  constructor(config: EmailProviderConfig) {
    this.apiKey = config.apiKey;
    this.domain = config.domain ?? '';
    this.defaultFrom = config.fromEmail ?? 'noreply@manifest.build';
  }

  async send(opts: SendEmailOptions): Promise<boolean> {
    if (!this.apiKey || !this.domain) {
      logger.warn('Mailgun not configured — skipping email send');
      return false;
    }

    if (!DOMAIN_RE.test(this.domain)) {
      logger.error('Invalid Mailgun domain — must be a valid hostname');
      return false;
    }

    try {
      const form = new URLSearchParams();
      form.append('from', opts.from ?? `Manifest <${this.defaultFrom}>`);
      form.append('to', opts.to);
      form.append('subject', opts.subject);
      form.append('html', opts.html);
      if (opts.text) form.append('text', opts.text);
      form.append('h:Reply-To', this.defaultFrom);
      form.append('o:tag', 'manifest');

      const url = new URL(`/v3/${encodeURIComponent(this.domain)}/messages`, MAILGUN_BASE);
      const res = await fetch(url.href, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
        },
        body: form,
      });

      if (!res.ok) {
        logger.error(`Mailgun returned ${res.status}: ${await res.text()}`);
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
