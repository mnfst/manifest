import * as React from 'react';
import { Button as EmailButton } from '@react-email/components';
import { colors } from './BaseLayout';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

/**
 * Shared button component for email templates.
 * Provides consistent CTA styling across all emails.
 */
export const Button: React.FC<ButtonProps> = ({
  href,
  children,
  variant = 'primary',
}) => {
  const isPrimary = variant === 'primary';

  return (
    <EmailButton
      href={href}
      style={{
        backgroundColor: isPrimary ? colors.primary : 'transparent',
        borderRadius: '6px',
        color: isPrimary ? colors.white : colors.primary,
        display: 'inline-block',
        fontSize: '16px',
        fontWeight: '600',
        lineHeight: '1',
        padding: '14px 28px',
        textAlign: 'center',
        textDecoration: 'none',
        border: isPrimary ? 'none' : `2px solid ${colors.primary}`,
      }}
    >
      {children}
    </EmailButton>
  );
};

export default Button;
