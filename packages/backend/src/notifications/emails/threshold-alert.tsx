import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Preview,
  Hr,
  Link,
  Img,
  Button,
} from '@react-email/components';
import { AppLocale, intlLocale } from '../../common/i18n/locale';

export interface ThresholdAlertProps {
  agentName: string;
  metricType: 'tokens' | 'cost';
  threshold: number;
  actualValue: number;
  period: string;
  timestamp: string;
  agentUrl: string;
  logoUrl?: string;
  alertType?: 'soft' | 'hard';
  periodResetDate?: string;
  locale?: AppLocale;
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: [
    'янв.',
    'февр.',
    'мар.',
    'апр.',
    'мая',
    'июн.',
    'июл.',
    'авг.',
    'сент.',
    'окт.',
    'нояб.',
    'дек.',
  ],
} as const satisfies Record<AppLocale, readonly string[]>;

const TIMESTAMP_FORMATTERS = {
  en: (day: number, month: string, time: string) => `${month} ${day}, ${time}`,
  ru: (day: number, month: string, time: string) => `${day} ${month}, ${time}`,
} satisfies Record<AppLocale, (day: number, month: string, time: string) => string>;

function formatTimestamp(raw: string, locale: AppLocale): string {
  const [datePart, timePart] = raw.split(' ');
  if (!datePart || !timePart) return raw;
  const [, month, day] = datePart.split('-');
  if (!month || !day) return raw;
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = MONTHS[locale][monthIdx] ?? month;
  const dayNum = parseInt(day, 10);
  return TIMESTAMP_FORMATTERS[locale](dayNum, monthName, timePart);
}

function formatValue(value: number, metric: string, locale: AppLocale): string {
  const num = Number(value);
  if (metric === 'cost') {
    return num.toLocaleString(intlLocale(locale), {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return num.toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 });
}

function metricLabel(metric: ThresholdAlertProps['metricType'], locale: AppLocale): string {
  const labels = {
    en: { tokens: 'tokens', cost: 'cost' },
    ru: { tokens: 'токенов', cost: 'расходов' },
  } satisfies Record<AppLocale, Record<ThresholdAlertProps['metricType'], string>>;
  return labels[locale][metric];
}

type PeriodLabelContext = 'afterPreposition' | 'metadata';

const RUSSIAN_PERIOD_LABELS: Record<string, Record<PeriodLabelContext, string>> = {
  hour: { afterPreposition: 'час', metadata: 'час' },
  day: { afterPreposition: 'день', metadata: 'день' },
  week: { afterPreposition: 'неделю', metadata: 'неделя' },
  month: { afterPreposition: 'месяц', metadata: 'месяц' },
};

function periodLabel(period: string, locale: AppLocale, context: PeriodLabelContext): string {
  const formatters = {
    en: (value: string) => value,
    ru: (value: string) => RUSSIAN_PERIOD_LABELS[value]?.[context] ?? value,
  } satisfies Record<AppLocale, (value: string) => string>;
  return formatters[locale](period);
}

interface ThresholdCopyContext {
  props: ThresholdAlertProps;
  isSoft: boolean;
  metric: string;
  localizedPeriod: string;
  thresholdValue: string;
  actualValue: string;
  resetTimestamp: string | null;
}

interface ThresholdCopy {
  preview: string;
  badge: string;
  heading: string;
  description: React.ReactNode;
  contextMessage: string;
  thresholdLabel: string;
  actualUsageLabel: string;
  periodLabel: string;
  triggeredLabel: string;
  cta: string;
  footerNote: string;
  rights: string;
}

function englishThresholdCopy({
  props,
  isSoft,
  thresholdValue,
  actualValue,
  resetTimestamp,
}: ThresholdCopyContext): ThresholdCopy {
  return {
    preview: isSoft
      ? `${props.agentName} exceeded ${props.metricType} threshold (${actualValue})`
      : `${props.agentName} has been blocked — ${props.metricType} limit reached (${actualValue} / ${thresholdValue})`,
    badge: isSoft ? 'Warning' : 'Agent blocked',
    heading: isSoft
      ? `${props.agentName} exceeded the ${props.metricType} limit`
      : `${props.agentName} has been blocked`,
    description: isSoft ? (
      <>
        Your agent <strong>{props.agentName}</strong> has exceeded the{' '}
        <strong>{props.metricType}</strong> threshold for the current{' '}
        <strong>{props.period}</strong> period.
      </>
    ) : (
      <>
        Your agent <strong>{props.agentName}</strong> has reached the{' '}
        <strong>{props.metricType}</strong> limit of <strong>{thresholdValue}</strong> per{' '}
        <strong>{props.period}</strong>. New requests are blocked to protect your budget.
      </>
    ),
    contextMessage: isSoft
      ? 'Requests are still being processed normally.'
      : `Requests are now blocked until the next period resets${resetTimestamp ? ` on ${resetTimestamp}` : ''}.`,
    thresholdLabel: 'Threshold',
    actualUsageLabel: isSoft ? 'Actual usage' : 'Current usage',
    periodLabel: 'Period',
    triggeredLabel: 'Triggered',
    cta: 'View Agent Dashboard →',
    footerNote: 'You are receiving this because you set up a notification rule in Manifest.',
    rights: 'All rights reserved.',
  };
}

function russianThresholdCopy({
  props,
  isSoft,
  metric,
  localizedPeriod,
  thresholdValue,
  actualValue,
  resetTimestamp,
}: ThresholdCopyContext): ThresholdCopy {
  return {
    preview: isSoft
      ? `${props.agentName}: превышен порог ${metric} (${actualValue})`
      : `${props.agentName}: интеграция заблокирована — достигнут лимит ${metric} (${actualValue} / ${thresholdValue})`,
    badge: isSoft ? 'Предупреждение' : 'Интеграция заблокирована',
    heading: isSoft
      ? `${props.agentName}: превышен лимит ${metric}`
      : `${props.agentName}: интеграция заблокирована`,
    description: isSoft ? (
      <>
        Для интеграции <strong>{props.agentName}</strong> превышен порог <strong>{metric}</strong>{' '}
        за <strong>{localizedPeriod}</strong>.
      </>
    ) : (
      <>
        Для интеграции <strong>{props.agentName}</strong> достигнут лимит <strong>{metric}</strong>{' '}
        <strong>{thresholdValue}</strong> за <strong>{localizedPeriod}</strong>. Новые запросы
        заблокированы для защиты вашего бюджета.
      </>
    ),
    contextMessage: isSoft
      ? 'Запросы продолжают обрабатываться в обычном режиме.'
      : `Запросы заблокированы до следующего периода${resetTimestamp ? ` (${resetTimestamp})` : ''}.`,
    thresholdLabel: 'Порог',
    actualUsageLabel: isSoft ? 'Фактическое использование' : 'Текущее использование',
    periodLabel: 'Период',
    triggeredLabel: 'Срабатывание',
    cta: 'Открыть панель интеграции →',
    footerNote: 'Вы получили это письмо, потому что настроили правило уведомлений в Manifest.',
    rights: 'Все права защищены.',
  };
}

const COPY = {
  en: englishThresholdCopy,
  ru: russianThresholdCopy,
} satisfies Record<AppLocale, (context: ThresholdCopyContext) => ThresholdCopy>;

export function ThresholdAlertEmail(props: ThresholdAlertProps) {
  const {
    metricType,
    threshold,
    actualValue,
    period,
    timestamp,
    agentUrl,
    logoUrl = 'https://app.manifest.build/manifest-logo.png',
    alertType = 'hard',
    periodResetDate,
  } = props;
  const locale = props.locale ?? 'en';
  const metric = metricLabel(metricType, locale);
  const localizedPeriod = periodLabel(period, locale, 'afterPreposition');
  const localizedPeriodMetadata = periodLabel(period, locale, 'metadata');

  const isSoft = alertType === 'soft';
  const thresholdValue = formatValue(threshold, metricType, locale);
  const actualValueFormatted = formatValue(actualValue, metricType, locale);
  const resetTimestamp = periodResetDate ? formatTimestamp(periodResetDate, locale) : null;
  const copy = COPY[locale]({
    props,
    isSoft,
    metric,
    localizedPeriod,
    thresholdValue,
    actualValue: actualValueFormatted,
    resetTimestamp,
  });
  const accentColor = isSoft ? '#ea580c' : '#dc2626';
  const accentBg = isSoft ? '#fff7ed' : '#fef2f2';
  const accentBorder = isSoft ? '#fed7aa' : '#fecaca';

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img src={logoUrl} alt="Manifest" height="32" style={logoImg} />
          </Section>

          {/* Main content */}
          <Section style={card}>
            {/* Alert badge */}
            <Section style={alertBadgeContainer}>
              <Text style={{ ...alertBadge, color: accentColor, backgroundColor: accentBg }}>
                {copy.badge}
              </Text>
            </Section>

            <Text style={heading}>{copy.heading}</Text>
            <Text style={paragraph}>{copy.description}</Text>

            {/* Context message */}
            {isSoft ? (
              <Text style={paragraph}>{copy.contextMessage}</Text>
            ) : (
              <Section
                style={{ ...hardLimitBox, backgroundColor: accentBg, borderColor: accentBorder }}
              >
                <Text style={{ ...hardLimitText, color: accentColor }}>{copy.contextMessage}</Text>
              </Section>
            )}

            {/* Stats row */}
            <Section style={statsRow}>
              <Section style={statBox}>
                <Text style={statLabel}>{copy.thresholdLabel}</Text>
                <Text style={statValue}>{thresholdValue}</Text>
              </Section>
              <Section
                style={{ ...statBoxAlert, backgroundColor: accentBg, borderColor: accentBorder }}
              >
                <Text style={statLabel}>{copy.actualUsageLabel}</Text>
                <Text style={{ ...statValueAlert, color: accentColor }}>
                  {actualValueFormatted}
                </Text>
              </Section>
            </Section>

            {/* Meta info */}
            <Section style={metaRow}>
              <Text style={metaText}>
                {copy.periodLabel}: {localizedPeriodMetadata}
              </Text>
              <Text style={metaText}>
                {copy.triggeredLabel}: {formatTimestamp(timestamp, locale)}
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={ctaContainer}>
              <Button style={ctaButton} href={agentUrl}>
                {copy.cta}
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerNote}>{copy.footerNote}</Text>
            <Text style={footerMuted}>
              © 2026 MNFST Inc. {copy.rights}{' '}
              <Link href="https://manifest.build" style={footerLink}>
                manifest.build
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ── Brand tokens ──────────────────────────────────── */
const brandBg = '#f8f6f1';
const brandCardBg = '#ffffff';
const brandFg = '#020817';
const brandMuted = '#64748b';
const brandBorder = '#e5dfd6';
const brandFont =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ── Styles ────────────────────────────────────────── */
const body: React.CSSProperties = {
  backgroundColor: brandBg,
  fontFamily: brandFont,
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '40px 20px',
};

const logoSection: React.CSSProperties = {
  textAlign: 'center' as const,
  paddingBottom: '32px',
};

const logoImg: React.CSSProperties = {
  margin: '0 auto',
};

const card: React.CSSProperties = {
  backgroundColor: brandCardBg,
  borderRadius: '12px',
  padding: '40px 36px',
  border: `1px solid ${brandBorder}`,
};

const alertBadgeContainer: React.CSSProperties = {
  marginBottom: '16px',
};

const alertBadge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  padding: '4px 10px',
  borderRadius: '6px',
  margin: 0,
};

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: brandFg,
  margin: '0 0 12px',
  lineHeight: '1.3',
};

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 28px',
};

const statsRow: React.CSSProperties = {
  marginBottom: '24px',
};

const statBox: React.CSSProperties = {
  backgroundColor: '#fafaf9',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '8px',
  border: `1px solid ${brandBorder}`,
};

const statBoxAlert: React.CSSProperties = {
  borderRadius: '8px',
  padding: '16px 20px',
  border: '1px solid',
};

const hardLimitBox: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid',
  marginBottom: '28px',
};

const hardLimitText: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  margin: 0,
  lineHeight: '1.5',
};

const statLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: brandMuted,
  margin: '0 0 4px',
};

const statValue: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: brandFg,
  margin: 0,
  letterSpacing: '-0.02em',
};

const statValueAlert: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.02em',
};

const metaRow: React.CSSProperties = {
  padding: '12px 0 0',
};

const metaText: React.CSSProperties = {
  fontSize: '12px',
  color: brandMuted,
  margin: '0 0 2px',
};

const ctaContainer: React.CSSProperties = {
  textAlign: 'center' as const,
  marginTop: '28px',
};

const ctaButton: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
};

const divider: React.CSSProperties = {
  borderColor: brandBorder,
  borderTop: 'none',
  margin: '32px 0 24px',
};

const footer: React.CSSProperties = {
  textAlign: 'center' as const,
};

const footerNote: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '0 0 16px',
  lineHeight: '1.5',
};

const footerMuted: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: 0,
};

const footerLink: React.CSSProperties = {
  color: '#94a3b8',
  textDecoration: 'underline',
};
