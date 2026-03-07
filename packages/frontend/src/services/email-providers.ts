export interface EmailProviderOption {
  id: string;
  name: string;
  logoSrc: string;
  apiKeyUrl: string;
}

export const EMAIL_PROVIDER_OPTIONS: EmailProviderOption[] = [
  {
    id: 'resend',
    name: 'Resend',
    logoSrc: '/logos/resend.svg',
    apiKeyUrl: 'https://resend.com/api-keys',
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    logoSrc: '/logos/mailgun.svg',
    apiKeyUrl: 'https://app.mailgun.com/app/account/security/api_keys',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    logoSrc: '/logos/sendgrid.svg',
    apiKeyUrl: 'https://app.sendgrid.com/settings/api_keys',
  },
];

export const getEmailProviderOption = (providerId: string): EmailProviderOption | undefined =>
  EMAIL_PROVIDER_OPTIONS.find((provider) => provider.id === providerId);
