import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Font,
  Preview,
} from '@react-email/components';

/**
 * Shared color constants for email templates
 */
export const colors = {
  primary: '#4F46E5', // Indigo
  primaryDark: '#4338CA',
  background: '#F9FAFB',
  white: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
};

/**
 * Shared typography styles
 */
export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  heading: {
    fontSize: '24px',
    fontWeight: '600',
    color: colors.text,
    margin: '0 0 16px 0',
    lineHeight: '1.3',
  },
  body: {
    fontSize: '16px',
    fontWeight: '400',
    color: colors.text,
    margin: '0 0 16px 0',
    lineHeight: '1.5',
  },
  small: {
    fontSize: '14px',
    fontWeight: '400',
    color: colors.textMuted,
    margin: '0',
    lineHeight: '1.5',
  },
};

interface BaseLayoutProps {
  preview?: string;
  children: React.ReactNode;
}

/**
 * Base layout component for all email templates.
 * Provides consistent structure, fonts, and styling.
 */
export const BaseLayout: React.FC<BaseLayoutProps> = ({ preview, children }) => {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      {preview && <Preview>{preview}</Preview>}
      <Body
        style={{
          backgroundColor: colors.background,
          fontFamily: typography.fontFamily,
          margin: '0',
          padding: '40px 0',
        }}
      >
        <Container
          style={{
            backgroundColor: colors.white,
            borderRadius: '8px',
            margin: '0 auto',
            maxWidth: '600px',
            padding: '0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Section
            style={{
              padding: '32px 40px',
            }}
          >
            {children}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BaseLayout;
