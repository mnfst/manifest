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
import type { AppLocale } from '../../common/i18n/locale';

export interface DoctorReleaseProps {
  /** The dashboard the reader lands on. */
  appUrl: string;
  /** The tutorial article (blog). Optional until published. */
  tutorialUrl?: string;
  logoUrl?: string;
  /** The Auto-fix gradient sparkle mark (hosted PNG). */
  autofixIconUrl?: string;
  locale?: AppLocale;
}

interface DoctorReleaseCopy {
  preview: string;
  newLabel: string;
  heading: string;
  paragraphs: readonly [string, string, string];
  dashboardCta: string;
  tutorialCta: string;
  footer: string;
}

const COPY = {
  en: {
    preview: 'Auto-fix is live on your account. Your failing requests can now repair themselves.',
    newLabel: 'New:',
    heading: 'Auto-fix is live on your account',
    paragraphs: [
      'You joined the waitlist. Here it is: Auto-fix shipped today, and it is already running on your account. You have nothing to turn on.',
      'From now on, when a provider rejects one of your requests with a fixable error, a renamed parameter, an unsupported field, a deprecated model, Manifest repairs the request and sends it again. Your agent gets its answer. You see the whole story in your dashboard: the failure, the fix, the retry.',
      'Auto-fix learns from real traffic. Each new error we patch works for every account, so the share of requests it can repair grows week after week.',
    ],
    dashboardCta: 'Open your dashboard',
    tutorialCta: 'How Auto-fix works',
    footer: 'You are receiving this email because you joined the Auto-fix waitlist on Manifest.',
  },
  ru: {
    preview:
      'Auto-fix уже доступен в вашем аккаунте. Теперь Manifest может автоматически исправлять ошибки в запросах и отправлять их повторно.',
    newLabel: 'Новинка:',
    heading: 'Auto-fix уже работает в вашем аккаунте',
    paragraphs: [
      'Вы записались в список ожидания, и вот Auto-fix уже доступен: сегодня мы запустили функцию в вашем аккаунте. Ничего дополнительно включать не нужно.',
      'Теперь, если провайдер отклонит запрос из-за исправимой ошибки, Manifest скорректирует запрос и отправит его повторно. Причиной может быть переименованный параметр, неподдерживаемое поле или устаревшая модель. Ваша интеграция получит ответ, а в панели управления вы увидите всю цепочку: ошибку, исправление и повторную попытку.',
      'Auto-fix совершенствуется на основе реального трафика. Каждое новое исправление становится доступно всем аккаунтам, поэтому каждую неделю функция сможет восстанавливать всё больше запросов.',
    ],
    dashboardCta: 'Открыть панель управления',
    tutorialCta: 'Как работает Auto-fix',
    footer: 'Вы получили это письмо, потому что записались в список ожидания Auto-fix в Manifest.',
  },
} satisfies Record<AppLocale, DoctorReleaseCopy>;

/**
 * The Auto-fix release announcement, sent once to every waitlist member when
 * the Doctor version ships. Copy rules: recovery vocabulary (a fallback is a
 * retry, an auto-fix produces an attempt), no em dashes, short sentences.
 */
export function DoctorReleaseEmail(props: DoctorReleaseProps) {
  const locale = props.locale ?? 'en';
  const copy = COPY[locale];
  const {
    appUrl,
    tutorialUrl,
    logoUrl = 'https://app.manifest.build/manifest-logo.png',
    autofixIconUrl = 'https://app.manifest.build/autofix-icon-email.png',
  } = props;

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
            <Section style={badgeContainer}>
              <Text style={newLine}>
                <span style={newLabel}>{copy.newLabel}</span>{' '}
                <Img src={autofixIconUrl} alt="" width="18" height="18" style={autofixIcon} />{' '}
                <span style={autofixName}>Auto-fix</span>
              </Text>
            </Section>

            <Text style={heading}>{copy.heading}</Text>

            {copy.paragraphs.map((text) => (
              <Text key={text} style={paragraph}>
                {text}
              </Text>
            ))}

            <Section style={buttonSection}>
              <Button href={appUrl} style={buttonPrimary}>
                {copy.dashboardCta}
              </Button>
              {tutorialUrl ? (
                <Button href={tutorialUrl} style={buttonSecondary}>
                  {copy.tutorialCta}
                </Button>
              ) : null}
            </Section>

            <Hr style={hr} />

            <Text style={footer}>{copy.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const brandBg = '#faf9f6';
const brandCardBg = '#ffffff';
const brandBorder = '#e8e5df';
const brandFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const brandInk = '#1a1a1a';
const brandMuted = '#6b6b6b';

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

const badgeContainer: React.CSSProperties = {
  marginBottom: '16px',
};

const newLine: React.CSSProperties = {
  fontSize: '14px',
  margin: 0,
  lineHeight: '18px',
};

const newLabel: React.CSSProperties = {
  color: brandInk,
  fontWeight: 600,
};

const autofixIcon: React.CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  borderRadius: '4px',
  margin: '0 2px',
};

const autofixName: React.CSSProperties = {
  color: brandInk,
  fontWeight: 700,
};

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: brandInk,
  margin: '0 0 16px',
  lineHeight: '1.3',
};

const paragraph: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: brandInk,
  margin: '0 0 16px',
};

const buttonSection: React.CSSProperties = {
  textAlign: 'left' as const,
  margin: '28px 0 20px',
};

const buttonBase: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
};

const buttonPrimary: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: brandInk,
  color: '#ffffff',
  marginRight: '12px',
};

const buttonSecondary: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: brandCardBg,
  color: brandInk,
  border: `1px solid ${brandBorder}`,
};

const hr: React.CSSProperties = {
  borderColor: brandBorder,
  margin: '24px 0 16px',
};

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: brandMuted,
  margin: 0,
};
