const logger = {
  warn: (msg: string) => console.warn(`[Mailgun] ${msg}`),
  error: (msg: string) => console.error(`[Mailgun] ${msg}`),
  log: (msg: string) => console.log(`[Mailgun] ${msg}`),
};

export interface SendMailgunEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendMailgunEmail(opts: SendMailgunEmailOptions): Promise<boolean> {
  const apiKey = process.env['MAILGUN_API_KEY'] ?? '';
  const domain = process.env['MAILGUN_DOMAIN'] ?? '';
  const defaultFrom = process.env['NOTIFICATION_FROM_EMAIL'] ?? 'noreply@manifest.build';

  if (!apiKey || !domain) {
    logger.warn('Mailgun not configured — skipping email send');
    return false;
  }

  try {
    const form = new URLSearchParams();
    form.append('from', opts.from ?? `Manifest <${defaultFrom}>`);
    form.append('to', opts.to);
    form.append('subject', opts.subject);
    form.append('html', opts.html);

    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
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
