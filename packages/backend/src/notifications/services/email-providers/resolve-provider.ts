import { EmailProvider, EmailProviderConfig } from './email-provider.interface';
import { MailgunProvider } from './mailgun.provider';
import { SendGridProvider } from './sendgrid.provider';
import { ResendProvider } from './resend.provider';

export function createProvider(config: EmailProviderConfig): EmailProvider {
  switch (config.provider) {
    case 'mailgun':
      return new MailgunProvider(config);
    case 'sendgrid':
      return new SendGridProvider(config);
    case 'resend':
      return new ResendProvider(config);
    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}
