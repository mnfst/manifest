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
} from '@react-email/components';

export function TestEmail() {
  return (
    <Html>
      <Head />
      <Preview>Your email configuration is working correctly</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Text style={logo}>manifest</Text>
          </Section>

          {/* Main content */}
          <Section style={card}>
            <Section style={badgeContainer}>
              <Text style={successBadge}>Configuration verified</Text>
            </Section>

            <Text style={heading}>Email is working</Text>
            <Text style={paragraph}>
              This is a test email from Manifest. If you're reading this, your
              email provider configuration is working correctly.
            </Text>
            <Text style={paragraph}>
              Notification emails — such as threshold alerts — will be delivered
              to this address.
            </Text>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerNote}>
              This is a one-time test email sent from Manifest.
            </Text>
            <Text style={footerMuted}>manifest.build</Text>
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

const logo: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: '#22110C',
  margin: 0,
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

const successBadge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#16a34a',
  backgroundColor: '#f0fdf4',
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
  margin: '0 0 16px',
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
