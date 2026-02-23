import { SendEmailOptions, EmailProviderConfig } from './email-provider.interface';
import { createProvider } from './resolve-provider';
import { readLocalEmailConfig } from '../../../common/constants/local-mode.constants';

const logger = {
  warn: (msg: string) => console.warn(`[Email] ${msg}`),
};

function resolveConfig(): EmailProviderConfig | null {
  const isLocal = process.env['MANIFEST_MODE'] === 'local';

  if (!isLocal) {
    const apiKey = process.env['MAILGUN_API_KEY'] ?? '';
    const domain = process.env['MAILGUN_DOMAIN'] ?? '';
    if (!apiKey || !domain) return null;
    return {
      provider: 'mailgun',
      apiKey,
      domain,
      fromEmail: process.env['NOTIFICATION_FROM_EMAIL'],
    };
  }

  return readLocalEmailConfig();
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const config = resolveConfig();
  if (!config) {
    logger.warn('No email provider configured — skipping email send');
    return false;
  }

  const provider = createProvider(config);
  return provider.send(opts);
}
