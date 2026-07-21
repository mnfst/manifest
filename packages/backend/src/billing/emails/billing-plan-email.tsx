import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Preview,
  Hr,
  Link,
  Img,
} from '@react-email/components';
import { AppLocale, intlLocale } from '../../common/i18n/locale';
import {
  planUsagePercentage,
  type SubscriptionEmailKind,
  type UsageEmailKind,
} from '../billing-email-copy';

export interface SubscriptionPlanEmailProps {
  kind: SubscriptionEmailKind;
  userName?: string | null;
  planName: string;
  previousPlanName?: string | null;
  periodEnd?: string | null;
  appUrl: string;
  manageBillingUrl: string;
  logoUrl?: string;
  locale?: AppLocale;
}

export interface PlanUsageEmailProps {
  kind: UsageEmailKind;
  userName?: string | null;
  used: number;
  limit: number;
  periodEnd: string;
  appUrl: string;
  logoUrl?: string;
  locale?: AppLocale;
}

function greeting(name: string | null | undefined, locale: AppLocale): string {
  const trimmed = name?.trim();
  const formatters = {
    en: (value?: string) => (value ? `Hi ${value},` : 'Hi,'),
    ru: (value?: string) => (value ? `Здравствуйте, ${value}!` : 'Здравствуйте!'),
  } satisfies Record<AppLocale, (value?: string) => string>;
  return formatters[locale](trimmed);
}

function formatCount(value: number, locale: AppLocale): string {
  return Math.round(value).toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 });
}

function formatDate(raw: string | null | undefined, locale: AppLocale): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(intlLocale(locale), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function accountUrl(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, '')}/account`;
}

function emailPreferencesUrl(appUrl: string): string {
  return `${accountUrl(appUrl)}#email-preferences`;
}

interface SubscriptionCopy {
  preview: string;
  badge: string;
  heading: string;
  body: React.ReactNode | 'multi';
  paragraphs?: React.ReactNode[];
  features?: string[];
  cta: string;
  ctaSecondary?: string;
}

function englishSubscriptionCopy(props: SubscriptionPlanEmailProps): SubscriptionCopy {
  const locale: AppLocale = 'en';
  if (props.kind === 'plan_changed') {
    return {
      preview: `Your Manifest plan changed to ${props.planName}`,
      badge: '',
      heading: `Your plan is now Manifest ${props.planName}`,
      body: (
        <>
          {greeting(props.userName, locale)} your plan has been updated
          {props.previousPlanName ? (
            <>
              {' '}
              from <strong>{props.previousPlanName}</strong>
            </>
          ) : null}{' '}
          to <strong>{props.planName}</strong>. Here's what you now have access to:
        </>
      ),
      features: [
        'Unlimited routed requests',
        '365 days dashboard retention',
        'Basic support (platform issues, billing, licence activation)',
      ],
      cta: 'Open Manifest',
    };
  }

  if (props.kind === 'cancellation_confirmed') {
    const end = formatDate(props.periodEnd, locale);
    return {
      preview: end
        ? `Your Manifest ${props.planName} plan is scheduled to end on ${end}`
        : `Your Manifest ${props.planName} plan is scheduled to end`,
      badge: '',
      heading: `${props.planName} cancellation confirmed`,
      body: 'multi',
      paragraphs: [
        <>
          {greeting(props.userName, locale)} we're sorry to see you go. Your{' '}
          <strong>{props.planName}</strong> cancellation has been confirmed. You'll keep full access
          to {props.planName} features{end ? ` until ${end}` : ''}.
        </>,
        <>
          After that date, your workspace will switch back to the Free plan with 10,000 routed
          requests per month and 7-day dashboard retention.
        </>,
        <>
          If there's anything we can do, or if you'd like to discuss your needs, we're here to help.
        </>,
      ],
      cta: 'Manage billing',
      ctaSecondary: 'Talk to sales',
    };
  }

  return {
    preview: `Your Manifest ${props.planName} plan is active`,
    badge: '',
    heading: `Welcome to Manifest ${props.planName}`,
    body: (
      <>
        {greeting(props.userName, locale)} your <strong>{props.planName}</strong> plan is active.
        The whole team warmly thanks you for your trust. Here's what you now have access to:
      </>
    ),
    features: [
      'Unlimited routed requests',
      '365 days dashboard retention',
      'Basic support (platform issues, billing, licence activation)',
    ],
    cta: 'Open Manifest',
  };
}

function russianSubscriptionCopy(props: SubscriptionPlanEmailProps): SubscriptionCopy {
  if (props.kind === 'plan_changed') {
    return {
      preview: `Ваш тариф Manifest изменён на ${props.planName}`,
      badge: '',
      heading: `Теперь ваш тариф — Manifest ${props.planName}`,
      body: (
        <>
          {greeting(props.userName, 'ru')} Ваш тариф изменён
          {props.previousPlanName ? (
            <>
              {' '}
              с <strong>{props.previousPlanName}</strong>
            </>
          ) : null}{' '}
          на <strong>{props.planName}</strong>. Теперь вам доступны:
        </>
      ),
      features: [
        'Неограниченное количество маршрутизируемых запросов',
        'Хранение данных панели управления в течение 365 дней',
        'Базовая поддержка по платформе, оплате и активации лицензии',
      ],
      cta: 'Открыть Manifest',
    };
  }

  if (props.kind === 'cancellation_confirmed') {
    const end = formatDate(props.periodEnd, 'ru');
    return {
      preview: end
        ? `Тариф Manifest ${props.planName} будет отключён ${end}`
        : `Тариф Manifest ${props.planName} будет отключён`,
      badge: '',
      heading: `Отмена тарифа ${props.planName} запланирована`,
      body: 'multi',
      paragraphs: [
        <>
          {greeting(props.userName, 'ru')} Нам жаль, что вы уходите. Отмена тарифа{' '}
          <strong>{props.planName}</strong> подтверждена. Все его возможности останутся доступны
          {end ? ` до ${end}` : ''}.
        </>,
        <>
          После этого рабочее пространство перейдёт на тариф Free: 10 000 маршрутизируемых запросов
          в месяц и хранение данных панели управления в течение 7 дней.
        </>,
        <>Если мы можем помочь или вы хотите обсудить свои задачи, свяжитесь с нами.</>,
      ],
      cta: 'Управлять оплатой',
      ctaSecondary: 'Связаться с отделом продаж',
    };
  }

  return {
    preview: `Тариф Manifest ${props.planName} активирован`,
    badge: '',
    heading: `Добро пожаловать в Manifest ${props.planName}`,
    body: (
      <>
        {greeting(props.userName, 'ru')} Ваш тариф <strong>{props.planName}</strong> активирован.
        Команда Manifest благодарит вас за доверие. Теперь вам доступны:
      </>
    ),
    features: [
      'Неограниченное количество маршрутизируемых запросов',
      'Хранение данных панели управления в течение 365 дней',
      'Базовая поддержка по платформе, оплате и активации лицензии',
    ],
    cta: 'Открыть Manifest',
  };
}

const SUBSCRIPTION_COPY = {
  en: englishSubscriptionCopy,
  ru: russianSubscriptionCopy,
} satisfies Record<AppLocale, (props: SubscriptionPlanEmailProps) => SubscriptionCopy>;

const SUBSCRIPTION_HINT = {
  en: 'This email confirms a Manifest plan change only. Stripe may send payment receipts separately.',
  ru: 'Это письмо подтверждает только изменение тарифа Manifest. Stripe может отправлять платёжные квитанции отдельно.',
} satisfies Record<AppLocale, string>;

interface UsageCopy {
  title: string;
  preview: string;
  summary: React.ReactNode;
  resetMessage: string;
  guidance: string;
  cta: string;
}

interface UsageCopyContext {
  props: PlanUsageEmailProps;
  percentage: number;
  isLimit: boolean;
  reset: string | null;
}

function englishUsageCopy({ props, percentage, isLimit, reset }: UsageCopyContext): UsageCopy {
  return {
    title: isLimit ? 'Monthly request limit reached' : `${percentage}% of monthly requests used`,
    preview: isLimit
      ? `Your Manifest workspace reached ${formatCount(props.limit, 'en')} monthly requests`
      : `Your Manifest workspace used ${percentage}% of monthly requests`,
    summary: (
      <>
        {greeting(props.userName, 'en')} your workspace has used{' '}
        <strong>{formatCount(props.used, 'en')}</strong> of{' '}
        <strong>{formatCount(props.limit, 'en')}</strong> included requests this month.
      </>
    ),
    resetMessage: isLimit
      ? `New routed requests are blocked until the limit resets${reset ? ` on ${reset}` : ''}.`
      : `Requests are still running. The limit resets${reset ? ` on ${reset}` : ' at the start of next month'}.`,
    guidance: isLimit
      ? 'Upgrade to Pro for unlimited requests.'
      : `If you reach ${formatCount(props.limit, 'en')}, new requests will stop being routed until the next period. To avoid interruptions, stay within your limit or upgrade to Pro for unlimited requests.`,
    cta: 'Review plan',
  };
}

function russianUsageCopy({ props, percentage, isLimit, reset }: UsageCopyContext): UsageCopy {
  return {
    title: isLimit
      ? 'Месячный лимит запросов исчерпан'
      : `Использовано ${percentage}\u00a0% месячного лимита запросов`,
    preview: isLimit
      ? `Рабочее пространство Manifest достигло лимита ${formatCount(props.limit, 'ru')} запросов в месяц`
      : `Рабочее пространство Manifest использовало ${percentage}\u00a0% месячного лимита запросов`,
    summary: (
      <>
        {greeting(props.userName, 'ru')} В этом месяце ваше рабочее пространство использовало{' '}
        <strong>{formatCount(props.used, 'ru')}</strong> из{' '}
        <strong>{formatCount(props.limit, 'ru')}</strong> включённых запросов.
      </>
    ),
    resetMessage: isLimit
      ? `Новые маршрутизируемые запросы заблокированы до сброса лимита${reset ? ` ${reset}` : ''}.`
      : `Запросы продолжают выполняться. Лимит сбросится${reset ? ` ${reset}` : ' в начале следующего месяца'}.`,
    guidance: isLimit
      ? 'Перейдите на тариф Pro, чтобы снять ограничение на количество запросов.'
      : `При достижении ${formatCount(props.limit, 'ru')} запросов маршрутизация новых запросов остановится до следующего периода. Чтобы избежать перерыва, не превышайте лимит или перейдите на тариф Pro без ограничения запросов.`,
    cta: 'Посмотреть тариф',
  };
}

const USAGE_COPY = {
  en: englishUsageCopy,
  ru: russianUsageCopy,
} satisfies Record<AppLocale, (context: UsageCopyContext) => UsageCopy>;

export function SubscriptionPlanEmail(props: SubscriptionPlanEmailProps) {
  const locale = props.locale ?? 'en';
  const logoUrl = props.logoUrl ?? 'https://app.manifest.build/manifest-logo.png';
  const copy = SUBSCRIPTION_COPY[locale](props);

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img src={logoUrl} alt="Manifest" height="32" style={logoImg} />
          </Section>

          <Section style={card}>
            <Text style={heading}>{copy.heading}</Text>
            {copy.paragraphs ? (
              copy.paragraphs.map((p, i) => (
                <Text key={i} style={paragraph}>
                  {p}
                </Text>
              ))
            ) : (
              <Text style={paragraph}>{copy.body}</Text>
            )}

            {copy.features && copy.features.length > 0 && (
              <Section style={{ margin: '0 0 24px' }}>
                {copy.features.map((feature) => (
                  <Text key={feature} style={featureItem}>
                    <span style={{ color: '#2632EF' }}>✓</span> {feature}
                  </Text>
                ))}
              </Section>
            )}

            <Section style={buttonContainer}>
              <Button
                style={button}
                href={
                  props.kind === 'subscription_confirmed' ? props.appUrl : props.manageBillingUrl
                }
              >
                {copy.cta}
              </Button>
              {copy.ctaSecondary && (
                <Button style={buttonSecondary} href="https://manifest.build/pricing">
                  {copy.ctaSecondary}
                </Button>
              )}
            </Section>

            <Text style={hint}>{SUBSCRIPTION_HINT[locale]}</Text>
          </Section>

          <Footer preferencesUrl={emailPreferencesUrl(props.appUrl)} locale={locale} />
        </Container>
      </Body>
    </Html>
  );
}

export function PlanUsageEmail(props: PlanUsageEmailProps) {
  const locale = props.locale ?? 'en';
  const logoUrl = props.logoUrl ?? 'https://app.manifest.build/manifest-logo.png';
  const isLimit = props.kind === 'requests_limit_reached';
  const percentage = planUsagePercentage(props.used, props.limit);
  const reset = formatDate(props.periodEnd, locale);
  const copy = USAGE_COPY[locale]({ props, percentage, isLimit, reset });

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img src={logoUrl} alt="Manifest" height="32" style={logoImg} />
          </Section>

          <Section style={card}>
            <Text style={heading}>{copy.title}</Text>
            <Text style={paragraph}>{copy.summary}</Text>

            <Text style={paragraph}>{copy.resetMessage}</Text>

            <Text style={paragraph}>{copy.guidance}</Text>

            <Section style={buttonContainer}>
              <Button style={button} href={`${props.appUrl.replace(/\/+$/, '')}/upgrade`}>
                {copy.cta}
              </Button>
            </Section>
          </Section>

          <Footer preferencesUrl={emailPreferencesUrl(props.appUrl)} locale={locale} />
        </Container>
      </Body>
    </Html>
  );
}

function Footer(props: { preferencesUrl: string; locale: AppLocale }) {
  const preferencesLabel = {
    en: 'Manage email preferences',
    ru: 'Настроить уведомления по электронной почте',
  } satisfies Record<AppLocale, string>;
  return (
    <>
      <Hr style={divider} />
      <Section style={footer}>
        <Text style={footerMuted}>
          <Link href={props.preferencesUrl} style={footerLink}>
            {preferencesLabel[props.locale]}
          </Link>
          {' · '}© 2026 MNFST Inc.{' '}
          <Link href="https://manifest.build" style={footerLink}>
            manifest.build
          </Link>
        </Text>
      </Section>
    </>
  );
}

const brandBg = '#f8f6f1';
const brandCardBg = '#ffffff';
const brandFg = '#020817';
const brandMuted = '#64748b';
const brandBorder = '#e5dfd6';
const brandPrimary = '#0f172a';
const brandPrimaryFg = '#f9f8f5';
const brandFont =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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
  textAlign: 'left' as const,
  paddingBottom: '32px',
};

const logoImg: React.CSSProperties = {};

const card: React.CSSProperties = {
  backgroundColor: brandCardBg,
  borderRadius: '12px',
  padding: '40px 36px',
  border: `1px solid ${brandBorder}`,
};

const badge: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '5px 10px',
  margin: '0 0 16px',
};

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: brandFg,
  margin: '0 0 12px',
  lineHeight: '1.3',
};

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 24px',
};

const buttonContainer: React.CSSProperties = {
  textAlign: 'left' as const,
  margin: '28px 0 0',
};

const button: React.CSSProperties = {
  backgroundColor: brandPrimary,
  color: brandPrimaryFg,
  fontSize: '13px',
  fontWeight: 600,
  padding: '8px 16px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
  lineHeight: '1',
};

const buttonSecondary: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: brandFg,
  fontSize: '13px',
  fontWeight: 600,
  padding: '8px 16px',
  borderRadius: '6px',
  border: `1px solid ${brandBorder}`,
  textDecoration: 'none',
  display: 'inline-block',
  lineHeight: '1',
  marginLeft: '8px',
};

const featureItem: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: brandFg,
  margin: '0 0 6px',
  padding: '0',
};

const hint: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: brandMuted,
  margin: '24px 0 0',
};

const notice: React.CSSProperties = {
  border: '1px solid',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '0 0 8px',
};

const noticeText: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.5',
  margin: 0,
};

const divider: React.CSSProperties = {
  borderColor: brandBorder,
  borderTop: 'none',
  margin: '32px 0 24px',
};

const footer: React.CSSProperties = {
  textAlign: 'center' as const,
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
