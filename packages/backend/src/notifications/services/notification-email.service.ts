import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import { ThresholdAlertEmail, ThresholdAlertProps } from '../emails/threshold-alert';
import { sendEmail } from './email-providers/send-email';
import { createProvider } from './email-providers/resolve-provider';
import type { EmailProviderConfig } from './email-providers/email-provider.interface';
import { LocaleService } from '../../common/services/locale.service';
import type { AppLocale } from '../../common/i18n/locale';

type ThresholdSubjectProps = Pick<ThresholdAlertProps, 'agentName' | 'metricType' | 'alertType'>;

const THRESHOLD_SUBJECTS = {
  en: ({ agentName, metricType, alertType }: ThresholdSubjectProps) =>
    alertType === 'soft'
      ? `Warning: ${agentName} exceeded ${metricType} threshold`
      : `Blocked: ${agentName} reached ${metricType} limit`,
  ru: ({ agentName, metricType, alertType }: ThresholdSubjectProps) => {
    const metric = metricType === 'cost' ? 'расходов' : 'токенов';
    return alertType === 'soft'
      ? `Предупреждение: для «${agentName}» превышен порог ${metric}`
      : `Заблокировано: для «${agentName}» достигнут лимит ${metric}`;
  },
} satisfies Record<AppLocale, (props: ThresholdSubjectProps) => string>;

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);
  private readonly fromEmail: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly locales: LocaleService,
  ) {
    this.fromEmail =
      this.configService.get<string>('app.emailFrom') ||
      this.configService.get<string>('app.notificationFromEmail', 'noreply@manifest.build');
  }

  async sendThresholdAlert(
    to: string,
    props: ThresholdAlertProps & { tenantId?: string | null },
    providerConfig?: { provider: string; apiKey: string; domain: string | null },
  ): Promise<boolean> {
    const { tenantId, ...emailProps } = props;
    const locale = emailProps.locale ?? (await this.locales.getTenantLocale(tenantId));
    const localizedProps = { ...emailProps, locale };
    const element = ThresholdAlertEmail(localizedProps);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = THRESHOLD_SUBJECTS[locale](props);

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
