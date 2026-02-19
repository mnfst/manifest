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

export interface ThresholdAlertProps {
  agentName: string;
  metricType: 'tokens' | 'cost';
  threshold: number;
  actualValue: number;
  period: string;
  timestamp: string;
}

function formatValue(value: number, metric: string): string {
  if (metric === 'cost') return `$${value.toFixed(4)}`;
  return value.toLocaleString();
}

export function ThresholdAlertEmail(props: ThresholdAlertProps) {
  const { agentName, metricType, threshold, actualValue, period, timestamp } =
    props;

  return (
    <Html>
      <Head />
      <Preview>
        {agentName} exceeded {metricType} threshold ({formatValue(actualValue, metricType)})
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Text style={logo}>manifest</Text>
          </Section>

          {/* Main content */}
          <Section style={card}>
            {/* Alert badge */}
            <Section style={alertBadgeContainer}>
              <Text style={alertBadge}>Threshold exceeded</Text>
            </Section>

            <Text style={heading}>
              {agentName} exceeded the {metricType} limit
            </Text>
            <Text style={paragraph}>
              Your agent <strong>{agentName}</strong> has exceeded the{' '}
              <strong>{metricType}</strong> threshold for the current{' '}
              <strong>{period}</strong> period.
            </Text>

            {/* Stats row */}
            <Section style={statsRow}>
              <Section style={statBox}>
                <Text style={statLabel}>Threshold</Text>
                <Text style={statValue}>
                  {formatValue(threshold, metricType)}
                </Text>
              </Section>
              <Section style={statBoxAlert}>
                <Text style={statLabel}>Actual usage</Text>
                <Text style={statValueAlert}>
                  {formatValue(actualValue, metricType)}
                </Text>
              </Section>
            </Section>

            {/* Meta info */}
            <Section style={metaRow}>
              <Text style={metaText}>
                Period: {period}
              </Text>
              <Text style={metaText}>
                Triggered: {timestamp}
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerNote}>
              You are receiving this because you set up a notification rule in
              Manifest.
            </Text>
            <Text style={footerMuted}>
              manifest.build
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

const alertBadgeContainer: React.CSSProperties = {
  marginBottom: '16px',
};

const alertBadge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#dc2626',
  backgroundColor: '#fef2f2',
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
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px 20px',
  border: '1px solid #fecaca',
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
  color: '#dc2626',
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
