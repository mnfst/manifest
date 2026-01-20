import * as React from 'react';
import { Section, Img, Text, Hr } from '@react-email/components';
import { colors, typography } from './BaseLayout';

// Manifest logo hosted on manifest.build
const MANIFEST_LOGO_URL = 'https://manifest.build/assets/images/logo-transparent.svg';

interface HeaderProps {
  appName?: string;
  logoUrl?: string;
}

/**
 * Shared header component for email templates.
 * Displays app logo/name and a divider.
 */
export const Header: React.FC<HeaderProps> = ({
  appName = 'Manifest',
  logoUrl = MANIFEST_LOGO_URL,
}) => {
  return (
    <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
      {logoUrl ? (
        <Img
          src={logoUrl}
          alt={appName}
          width="120"
          height="40"
          style={{ margin: '0 auto 16px auto' }}
        />
      ) : (
        <Text
          style={{
            ...typography.heading,
            color: colors.primary,
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 16px 0',
          }}
        >
          {appName}
        </Text>
      )}
      <Hr
        style={{
          borderColor: colors.border,
          borderWidth: '1px 0 0 0',
          margin: '0',
        }}
      />
    </Section>
  );
};

export default Header;
