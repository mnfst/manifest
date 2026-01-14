import * as React from 'react';
import { Section, Text, Heading } from '@react-email/components';
import { EmailChangeVerificationEmailProps } from '@chatgpt-app-builder/shared';
import { BaseLayout, Header, Footer, Button, typography, colors } from './components';

interface EmailChangeVerificationTemplateProps extends EmailChangeVerificationEmailProps {
  appName?: string;
}

/**
 * Email change verification template.
 * Sent when a user requests to change their email address.
 */
export const EmailChangeVerificationEmail: React.FC<EmailChangeVerificationTemplateProps> = ({
  userName,
  newEmail,
  verificationLink,
  expiresIn = '24 hours',
  appName = 'Manifest',
}) => {
  // Truncate long usernames for display
  const displayName = userName.length > 50 ? userName.substring(0, 50) + '...' : userName;

  return (
    <BaseLayout preview={`Verify your new ${appName} email address`}>
      <Header appName={appName} />

      <Section style={{ marginTop: '24px' }}>
        <Heading as="h1" style={typography.heading}>
          Verify Your New Email Address
        </Heading>

        <Text style={typography.body}>
          Hi {displayName},
        </Text>

        <Text style={typography.body}>
          You requested to change your email address to <strong>{newEmail}</strong>.
          Click the button below to verify this change:
        </Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={verificationLink}>Verify Email Address</Button>
        </Section>

        <Text style={typography.body}>
          This link will expire in <strong>{expiresIn}</strong>. If you didn't
          request this email change, you can safely ignore this email and your
          email address will remain unchanged.
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
            {verificationLink}
          </Text>
        </Section>
      </Section>

      <Footer companyName={appName} />
    </BaseLayout>
  );
};

export default EmailChangeVerificationEmail;

/**
 * Subject line for email change verification emails
 */
export const getEmailChangeVerificationSubject = (appName = 'Manifest'): string => {
  return `Verify your new ${appName} email address`;
};
