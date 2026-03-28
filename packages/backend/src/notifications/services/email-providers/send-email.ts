import { SendEmailOptions, EmailProviderConfig } from './email-provider.interface';
import { createProvider } from './resolve-provider';
import { readLocalEmailConfig } from '../../../common/constants/local-mode.constants';

const logger = {
  warn: (msg: string) => console.warn(`[Email] ${msg}`),
};

export interface SendEmailEnvConfig {
  manifestMode?: string;
  mailgunApiKey?: string;
  mailgunDomain?: string;
  notificationFromEmail?: string;
}

function resolveConfig(env?: SendEmailEnvConfig): EmailProviderConfig | null {
  const isLocal = (env?.manifestMode ?? process.env['MANIFEST_MODE']) === 'local';

  if (!isLocal) {
    const apiKey = env?.mailgunApiKey ?? process.env['MAILGUN_API_KEY'] ?? '';
    const domain = env?.mailgunDomain ?? process.env['MAILGUN_DOMAIN'] ?? '';
    if (!apiKey || !domain) return null;
    return {
      provider: 'mailgun',
      apiKey,
      domain,
      fromEmail: env?.notificationFromEmail ?? process.env['NOTIFICATION_FROM_EMAIL'],
    };
  }

  return readLocalEmailConfig();
}

export async function sendEmail(
  opts: SendEmailOptions,
  env?: SendEmailEnvConfig,
): Promise<boolean> {
  const config = resolveConfig(env);
  if (!config) {
    logger.warn('No email provider configured — skipping email send');
    return false;
  }

  const provider = createProvider(config);
  return provider.send(opts);
}
