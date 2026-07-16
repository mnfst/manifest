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

export interface DoctorReleaseProps {
  /** The dashboard the reader lands on. */
  appUrl: string;
  /** The tutorial article (blog). Optional until published. */
  tutorialUrl?: string;
  logoUrl?: string;
}

/**
 * The Auto-fix release announcement, sent once to every waitlist member when
 * the Doctor version ships. Copy rules: recovery vocabulary (a fallback is a
 * retry, an auto-fix produces an attempt), no em dashes, short sentences.
 */
export function DoctorReleaseEmail(props: DoctorReleaseProps) {
  const { appUrl, tutorialUrl, logoUrl = 'https://app.manifest.build/manifest-logo.png' } = props;

  return (
    <Html>
      <Head />
      <Preview>
        Auto-fix is live on your account. Your failing requests can now repair themselves.
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img src={logoUrl} alt="Manifest" height="32" style={logoImg} />
          </Section>

          <Section style={card}>
            <Section style={badgeContainer}>
              <Text style={badge}>New</Text>
            </Section>

            <Text style={heading}>Auto-fix is live on your account</Text>

            <Text style={paragraph}>
              You joined the waitlist. Here it is: Auto-fix shipped today, and it is already running
              on your account. You have nothing to turn on.
            </Text>

            <Text style={paragraph}>
              From now on, when a provider rejects one of your requests with a fixable error, a
              renamed parameter, an unsupported field, a deprecated model, Manifest repairs the
              request and sends it again. Your agent gets its answer. You see the whole story in
              your dashboard: the failure, the fix, the retry.
            </Text>

            <Text style={paragraph}>
              Auto-fix learns from real traffic. Each new error we patch works for every account, so
              the share of requests it can repair grows week after week.
            </Text>

            <Section style={buttonSection}>
              <Button href={appUrl} style={button}>
                Open your dashboard
              </Button>
            </Section>

            {tutorialUrl ? (
              <Text style={secondary}>
                Five minutes to see it in action:{' '}
                <Link href={tutorialUrl} style={link}>
                  how Auto-fix works
                </Link>
                .
              </Text>
            ) : null}

            <Hr style={hr} />

            <Text style={footer}>
              You are receiving this email because you joined the Auto-fix waitlist on Manifest.
            </Text>
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
const brandAccent = '#0d9488';

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

const badge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  padding: '4px 10px',
  borderRadius: '6px',
  color: brandAccent,
  backgroundColor: '#f0fdfa',
  margin: 0,
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
  textAlign: 'center' as const,
  margin: '28px 0 20px',
};

const button: React.CSSProperties = {
  backgroundColor: brandAccent,
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
};

const secondary: React.CSSProperties = {
  fontSize: '13px',
  color: brandMuted,
  textAlign: 'center' as const,
  margin: '0 0 8px',
};

const link: React.CSSProperties = {
  color: brandAccent,
  textDecoration: 'underline',
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
