import * as React from 'react';
import { Section, Text, Heading } from '@react-email/components';
import { PasswordResetEmailProps } from '@manifest/shared';
import { BaseLayout, Header, Footer, Button, typography, colors } from './components';

interface PasswordResetTemplateProps extends PasswordResetEmailProps {
  appName?: string;
}

/**
 * Password reset email template.
 * Sent when a user requests to reset their password.
 */
export const PasswordResetEmail: React.FC<PasswordResetTemplateProps> = ({
  userName,
  resetLink,
  expiresIn = '1 hour',
  appName = 'Manifest',
}) => {
  // Truncate long usernames for display
  const displayName = userName.length > 50 ? userName.substring(0, 50) + '...' : userName;

  return (
    <BaseLayout preview={`Reset your ${appName} password`}>
      <Header appName={appName} />

      <Section style={{ marginTop: '24px' }}>
        <Heading as="h1" style={typography.heading}>
          Reset Your Password
        </Heading>

        <Text style={typography.body}>
          Hi {displayName},
        </Text>

        <Text style={typography.body}>
          We received a request to reset your password. Click the button below to
          create a new password:
        </Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={resetLink}>Reset Password</Button>
        </Section>

        <Text style={typography.body}>
          This link will expire in <strong>{expiresIn}</strong>. If you didn't
          request a password reset, you can safely ignore this email.
        </Text>

        <Section
          style={{
            backgroundColor: colors.background,
            borderRadius: '6px',
            padding: '16px',
            marginTop: '24px',
          }}
        >
          <Text style={{ ...typography.small, margin: '0' }}>
            If the button above doesn't work, copy and paste this URL into your browser:
          </Text>
          <Text
            style={{
              ...typography.small,
              color: colors.primary,
              wordBreak: 'break-all',
              margin: '8px 0 0 0',
            }}
          >
            {resetLink}
          </Text>
        </Section>
      </Section>

      <Footer companyName={appName} />
    </BaseLayout>
  );
};

export default PasswordResetEmail;

/**
 * Subject line for password reset emails
 */
export const getPasswordResetSubject = (appName = 'Manifest'): string => {
  return `Reset your ${appName} password`;
};
