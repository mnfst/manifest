export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(opts: SendEmailOptions): Promise<boolean>;
}

export type EmailProviderType = 'mailgun' | 'sendgrid' | 'resend';

export interface EmailProviderConfig {
  provider: EmailProviderType;
  apiKey: string;
  domain?: string;
  fromEmail?: string;
}
