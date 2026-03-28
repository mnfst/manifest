import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import { ThresholdAlertEmail, ThresholdAlertProps } from '../emails/threshold-alert';
import { sendEmail } from './email-providers/send-email';
import { createProvider } from './email-providers/resolve-provider';
import type { EmailProviderConfig } from './email-providers/email-provider.interface';

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>(
      'app.notificationFromEmail',
      'noreply@manifest.build',
    );
  }

  async sendThresholdAlert(
    to: string,
    props: ThresholdAlertProps,
    providerConfig?: { provider: string; apiKey: string; domain: string | null },
  ): Promise<boolean> {
    const element = ThresholdAlertEmail(props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const prefix = props.alertType === 'soft' ? 'Warning' : 'Alert';
    const subject = `${prefix}: ${props.agentName} exceeded ${props.metricType} threshold`;

    if (providerConfig) {
      const defaultFrom = this.fromEmail;
      const from = providerConfig.domain
        ? `Manifest <noreply@${providerConfig.domain}>`
        : `Manifest <${defaultFrom}>`;
      const config: EmailProviderConfig = {
        provider: providerConfig.provider as EmailProviderConfig['provider'],
        apiKey: providerConfig.apiKey,
        domain: providerConfig.domain ?? undefined,
      };
      const provider = createProvider(config);
      const sent = await provider.send({ to, subject, html, text, from });
      if (sent) {
        this.logger.log(`Threshold alert sent to ${to} for agent ${props.agentName}`);
      }
      return sent;
    }

    const from = `Manifest <${this.fromEmail}>`;
    const sent = await sendEmail({ to, subject, html, text, from });
    if (sent) {
      this.logger.log(`Threshold alert sent to ${to} for agent ${props.agentName}`);
    }
    return sent;
  }
}
