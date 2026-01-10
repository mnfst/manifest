import { EmailMessage, EmailSendResult } from '@chatgpt-app-builder/shared';

/**
 * Interface for email sending providers.
 * Implementations must handle the actual sending of emails via their respective APIs.
 */
export interface EmailProvider {
  /**
   * Send an email message
   * @param message - The composed email to send
   * @returns Result of the send attempt
   */
  send(message: EmailMessage): Promise<EmailSendResult>;

  /**
   * Validate provider configuration
   * @returns true if provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Get the provider name for logging and diagnostics
   */
  getName(): string;
}

/**
 * Injection token for email provider
 */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
