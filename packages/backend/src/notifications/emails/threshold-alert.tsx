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
} as const;

function formatTimestamp(raw: string, locale: AppLocale): string {
  const [datePart, timePart] = raw.split(' ');
  if (!datePart || !timePart) return raw;
  const [, month, day] = datePart.split('-');
  if (!month || !day) return raw;
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = MONTHS[locale][monthIdx] ?? month;
  const dayNum = parseInt(day, 10);
  return locale === 'ru'
    ? `${dayNum} ${monthName}, ${timePart}`
    : `${monthName} ${dayNum}, ${timePart}`;
}

function formatValue(value: number, metric: string, locale: AppLocale): string {
  const num = Number(value);
  if (metric === 'cost')
    return `$${num.toLocaleString(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return num.toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 });
}

function metricLabel(metric: ThresholdAlertProps['metricType'], locale: AppLocale): string {
  if (locale === 'ru') return metric === 'cost' ? 'расходов' : 'токенов';
  return metric;
}

type PeriodLabelContext = 'afterPreposition' | 'metadata';

const RUSSIAN_PERIOD_LABELS: Record<string, Record<PeriodLabelContext, string>> = {
  hour: { afterPreposition: 'час', metadata: 'час' },
  day: { afterPreposition: 'день', metadata: 'день' },
  week: { afterPreposition: 'неделю', metadata: 'неделя' },
  month: { afterPreposition: 'месяц', metadata: 'месяц' },
};

function periodLabel(period: string, locale: AppLocale, context: PeriodLabelContext): string {
  if (locale !== 'ru') return period;
  return RUSSIAN_PERIOD_LABELS[period]?.[context] ?? period;
}

export function ThresholdAlertEmail(props: ThresholdAlertProps) {
  const {
    agentName,
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
  const accentColor = isSoft ? '#ea580c' : '#dc2626';
  const accentBg = isSoft ? '#fff7ed' : '#fef2f2';
  const accentBorder = isSoft ? '#fed7aa' : '#fecaca';

  return (
    <Html lang={locale}>
      <Head />
      <Preview>
        {locale === 'ru'
          ? isSoft
            ? `${agentName}: превышен порог ${metric} (${formatValue(actualValue, metricType, locale)})`
            : `${agentName}: интеграция заблокирована — достигнут лимит ${metric} (${formatValue(actualValue, metricType, locale)} / ${formatValue(threshold, metricType, locale)})`
          : isSoft
            ? `${agentName} exceeded ${metricType} threshold (${formatValue(actualValue, metricType, locale)})`
            : `${agentName} has been blocked — ${metricType} limit reached (${formatValue(actualValue, metricType, locale)} / ${formatValue(threshold, metricType, locale)})`}
      </Preview>
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
                {locale === 'ru'
                  ? isSoft
                    ? 'Предупреждение'
                    : 'Интеграция заблокирована'
                  : isSoft
                    ? 'Warning'
                    : 'Agent blocked'}
              </Text>
            </Section>

            <Text style={heading}>
              {locale === 'ru'
                ? isSoft
                  ? `${agentName}: превышен лимит ${metric}`
                  : `${agentName}: интеграция заблокирована`
                : isSoft
                  ? `${agentName} exceeded the ${metricType} limit`
                  : `${agentName} has been blocked`}
            </Text>
            <Text style={paragraph}>
              {locale === 'ru' ? (
                isSoft ? (
                  <>
                    Для интеграции <strong>{agentName}</strong> превышен порог{' '}
                    <strong>{metric}</strong> за <strong>{localizedPeriod}</strong>.
                  </>
                ) : (
                  <>
                    Для интеграции <strong>{agentName}</strong> достигнут лимит{' '}
                    <strong>{metric}</strong>{' '}
                    <strong>{formatValue(threshold, metricType, locale)}</strong> за{' '}
                    <strong>{localizedPeriod}</strong>. Новые запросы заблокированы для защиты
                    вашего бюджета.
                  </>
                )
              ) : isSoft ? (
                <>
                  Your agent <strong>{agentName}</strong> has exceeded the{' '}
                  <strong>{metricType}</strong> threshold for the current <strong>{period}</strong>{' '}
                  period.
                </>
              ) : (
                <>
                  Your agent <strong>{agentName}</strong> has reached the{' '}
                  <strong>{metricType}</strong> limit of{' '}
                  <strong>{formatValue(threshold, metricType, locale)}</strong> per{' '}
                  <strong>{period}</strong>. New requests are blocked to protect your budget.
                </>
              )}
            </Text>

            {/* Context message */}
            {isSoft ? (
              <Text style={paragraph}>
                {locale === 'ru'
                  ? 'Запросы продолжают обрабатываться в обычном режиме.'
                  : 'Requests are still being processed normally.'}
              </Text>
            ) : (
              <Section
                style={{ ...hardLimitBox, backgroundColor: accentBg, borderColor: accentBorder }}
              >
                <Text style={{ ...hardLimitText, color: accentColor }}>
                  {locale === 'ru'
                    ? `Запросы заблокированы до следующего периода${periodResetDate ? ` (${formatTimestamp(periodResetDate, locale)})` : ''}.`
                    : `Requests are now blocked until the next period resets${periodResetDate ? ` on ${formatTimestamp(periodResetDate, locale)}` : ''}.`}
                </Text>
              </Section>
            )}

            {/* Stats row */}
            <Section style={statsRow}>
              <Section style={statBox}>
                <Text style={statLabel}>{locale === 'ru' ? 'Порог' : 'Threshold'}</Text>
                <Text style={statValue}>{formatValue(threshold, metricType, locale)}</Text>
              </Section>
              <Section
                style={{ ...statBoxAlert, backgroundColor: accentBg, borderColor: accentBorder }}
              >
                <Text style={statLabel}>
                  {locale === 'ru'
                    ? isSoft
                      ? 'Фактическое использование'
                      : 'Текущее использование'
                    : isSoft
                      ? 'Actual usage'
                      : 'Current usage'}
                </Text>
                <Text style={{ ...statValueAlert, color: accentColor }}>
                  {formatValue(actualValue, metricType, locale)}
                </Text>
              </Section>
            </Section>

            {/* Meta info */}
            <Section style={metaRow}>
              <Text style={metaText}>
                {locale === 'ru' ? 'Период' : 'Period'}: {localizedPeriodMetadata}
              </Text>
              <Text style={metaText}>
                {locale === 'ru' ? 'Срабатывание' : 'Triggered'}:{' '}
                {formatTimestamp(timestamp, locale)}
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={ctaContainer}>
              <Button style={ctaButton} href={agentUrl}>
                {locale === 'ru' ? 'Открыть панель интеграции →' : 'View Agent Dashboard →'}
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerNote}>
              {locale === 'ru'
                ? 'Вы получили это письмо, потому что настроили правило уведомлений в Manifest.'
                : 'You are receiving this because you set up a notification rule in Manifest.'}
            </Text>
            <Text style={footerMuted}>
              © 2026 MNFST Inc. {locale === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}{' '}
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
