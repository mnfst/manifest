import * as React from 'react';
import { Section, Text, Hr, Link } from '@react-email/components';
import { colors, typography } from './BaseLayout';

interface FooterProps {
  companyName?: string;
  companyAddress?: string;
  unsubscribeUrl?: string;
}

/**
 * Shared footer component for email templates.
 * Displays company info, help link, and optional unsubscribe link.
 */
export const Footer: React.FC<FooterProps> = ({
  companyName = 'Manifest',
  companyAddress,
  unsubscribeUrl,
}) => {
  return (
    <Section style={{ marginTop: '32px' }}>
      <Hr
        style={{
          borderColor: colors.border,
          borderWidth: '1px 0 0 0',
          margin: '0 0 24px 0',
        }}
      />
      <Text
        style={{
          ...typography.small,
          textAlign: 'center',
          marginBottom: '8px',
        }}
      >
        This email was sent by {companyName}.
      </Text>
      {companyAddress && (
        <Text
          style={{
            ...typography.small,
            textAlign: 'center',
            marginBottom: '8px',
          }}
        >
          {companyAddress}
        </Text>
      )}
      <Text
        style={{
          ...typography.small,
          textAlign: 'center',
          marginBottom: '8px',
        }}
      >
        If you have any questions, please contact our support team.
      </Text>
      {unsubscribeUrl && (
        <Text
          style={{
            ...typography.small,
            textAlign: 'center',
          }}
        >
          <Link
            href={unsubscribeUrl}
            style={{
              color: colors.textMuted,
              textDecoration: 'underline',
            }}
          >
            Unsubscribe from these emails
          </Link>
        </Text>
      )}
    </Section>
  );
};

export default Footer;
