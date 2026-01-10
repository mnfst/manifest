import * as React from 'react';
import { Section, Text, Heading } from '@react-email/components';
import { InvitationEmailProps } from '@chatgpt-app-builder/shared';
import { BaseLayout, Header, Footer, Button, typography, colors } from './components';

interface InvitationTemplateProps extends InvitationEmailProps {
  appLogo?: string;
}

/**
 * Invitation email template.
 * Sent when a user invites someone to view or collaborate on an app.
 */
export const InvitationEmail: React.FC<InvitationTemplateProps> = ({
  inviterName,
  appName,
  appLink,
  personalMessage,
  appLogo,
}) => {
  // Truncate long names for display
  const displayInviterName =
    inviterName.length > 50 ? inviterName.substring(0, 50) + '...' : inviterName;
  const displayAppName =
    appName.length > 50 ? appName.substring(0, 50) + '...' : appName;

  return (
    <BaseLayout preview={`${displayInviterName} invited you to ${displayAppName}`}>
      <Header appName={displayAppName} logoUrl={appLogo} />

      <Section style={{ marginTop: '24px' }}>
        <Heading as="h1" style={typography.heading}>
          You've Been Invited!
        </Heading>

        <Text style={typography.body}>
          <strong>{displayInviterName}</strong> has invited you to join{' '}
          <strong>{displayAppName}</strong>.
        </Text>

        {personalMessage && (
          <Section
            style={{
              backgroundColor: colors.background,
              borderRadius: '6px',
              padding: '16px',
              marginTop: '16px',
              marginBottom: '16px',
              borderLeft: `4px solid ${colors.primary}`,
            }}
          >
            <Text
              style={{
                ...typography.body,
                fontStyle: 'italic',
                margin: '0',
                color: colors.textMuted,
              }}
            >
              "{personalMessage}"
            </Text>
            <Text
              style={{
                ...typography.small,
                margin: '8px 0 0 0',
              }}
            >
              — {displayInviterName}
            </Text>
          </Section>
        )}

        <Text style={typography.body}>
          Click the button below to accept the invitation and get started:
        </Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={appLink}>Accept Invitation</Button>
        </Section>

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
            {appLink}
          </Text>
        </Section>

        <Text
          style={{
            ...typography.small,
            marginTop: '24px',
          }}
        >
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
      </Section>

      <Footer companyName={displayAppName} />
    </BaseLayout>
  );
};

export default InvitationEmail;

/**
 * Subject line for invitation emails
 */
export const getInvitationSubject = (
  inviterName: string,
  appName: string,
): string => {
  const truncatedInviter =
    inviterName.length > 30 ? inviterName.substring(0, 30) + '...' : inviterName;
  const truncatedApp = appName.length > 30 ? appName.substring(0, 30) + '...' : appName;
  return `${truncatedInviter} invited you to ${truncatedApp}`;
};
