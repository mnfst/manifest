import {
  SendEmailOptions,
  EmailProviderConfig,
  EmailProviderType,
} from './email-provider.interface';
import { createProvider } from './resolve-provider';

const logger = {
  warn: (msg: string) => console.warn(`[Email] ${msg}`),
};

export interface SendEmailEnvConfig {
  // Unified scheme (preferred)
  emailProvider?: string;
  emailApiKey?: string;
  emailDomain?: string;
  emailFrom?: string;
  // Legacy Mailgun-only (backward compat)
  mailgunApiKey?: string;
  mailgunDomain?: string;
  notificationFromEmail?: string;
}

function isValidProvider(p: string): p is EmailProviderType {
  return p === 'mailgun' || p === 'resend' || p === 'sendgrid';
}

function resolveConfig(env?: SendEmailEnvConfig): EmailProviderConfig | null {
  // Unified scheme takes precedence
  const provider = env?.emailProvider ?? process.env['EMAIL_PROVIDER'];
  const apiKey = env?.emailApiKey ?? process.env['EMAIL_API_KEY'];
  if (provider && apiKey) {
    if (!isValidProvider(provider)) {
      logger.warn(`Unknown EMAIL_PROVIDER=${provider}. Expected: mailgun, resend, or sendgrid.`);
      return null;
    }
    const domain = env?.emailDomain ?? process.env['EMAIL_DOMAIN'];
    if (provider === 'mailgun' && !domain) {
      logger.warn('EMAIL_PROVIDER=mailgun requires EMAIL_DOMAIN. Skipping email send.');
      return null;
    }
    return {
      provider,
      apiKey,
      domain,
      fromEmail:
        env?.emailFrom ?? process.env['EMAIL_FROM'] ?? process.env['NOTIFICATION_FROM_EMAIL'],
    };
  }

  // Backward compat: legacy Mailgun-only env vars
  const mailgunApiKey = env?.mailgunApiKey ?? process.env['MAILGUN_API_KEY'] ?? '';
  const mailgunDomain = env?.mailgunDomain ?? process.env['MAILGUN_DOMAIN'] ?? '';
  if (mailgunApiKey && mailgunDomain) {
    return {
      provider: 'mailgun',
      apiKey: mailgunApiKey,
      domain: mailgunDomain,
      fromEmail: env?.notificationFromEmail ?? process.env['NOTIFICATION_FROM_EMAIL'],
    };
  }

  return null;
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
