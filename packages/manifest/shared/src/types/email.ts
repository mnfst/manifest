/**
 * Email types for the Generator application.
 * Used by both backend email module and any frontend that needs email-related types.
 */

/**
 * Available email template types
 */
export enum EmailTemplateType {
  PASSWORD_RESET = 'password-reset',
  INVITATION = 'invitation',
  EMAIL_CHANGE_VERIFICATION = 'email-change-verification',
}

/**
 * A composed email ready to send
 */
export interface EmailMessage {
  /** Recipient email address */
  to: string;
  /** Sender email address */
  from: string;
  /** Email subject line */
  subject: string;
  /** Rendered HTML content */
  html: string;
  /** Plain text fallback content */
  text?: string;
  /** Reply-to address if different from sender */
  replyTo?: string;
}

/**
 * The outcome of an email send attempt
 */
export interface EmailSendResult {
  /** Whether the send succeeded */
  success: boolean;
  /** Provider-assigned message ID (if successful) */
  messageId?: string;
  /** Error message (if failed) */
  error?: string;
  /** When the send was attempted */
  timestamp: Date;
}

/**
 * Props for password reset email template
 */
export interface PasswordResetEmailProps {
  /** User's display name */
  userName: string;
  /** Password reset URL with token */
  resetLink: string;
  /** Human-readable expiration (default: "1 hour") */
  expiresIn?: string;
}

/**
 * Props for invitation email template
 */
export interface InvitationEmailProps {
  /** Name of user who sent invitation */
  inviterName: string;
  /** Name of the application */
  appName: string;
  /** Link to access the app */
  appLink: string;
  /** Optional personal message from inviter */
  personalMessage?: string;
}

/**
 * Props for email change verification template
 */
export interface EmailChangeVerificationEmailProps {
  /** User's display name */
  userName: string;
  /** The new email address being verified */
  newEmail: string;
  /** Email verification URL with token */
  verificationLink: string;
  /** Human-readable expiration (default: "24 hours") */
  expiresIn?: string;
}

/**
 * Union type for all template props (type-safe rendering)
 */
export type EmailTemplateProps =
  | ({ type: EmailTemplateType.PASSWORD_RESET } & PasswordResetEmailProps)
  | ({ type: EmailTemplateType.INVITATION } & InvitationEmailProps)
  | ({ type: EmailTemplateType.EMAIL_CHANGE_VERIFICATION } & EmailChangeVerificationEmailProps);

/**
 * Request DTO for sending emails via API
 */
export interface SendEmailRequest {
  /** Recipient email address */
  to: string;
  /** Template type to render */
  template: EmailTemplateType;
  /** Template-specific properties */
  props: Record<string, unknown>;
  /** Optional reply-to address */
  replyTo?: string;
}

/**
 * Response DTO for email send operations
 */
export interface EmailResultResponse {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Provider-assigned message ID */
  messageId?: string;
  /** Error message if send failed */
  error?: string;
}

/**
 * Email configuration status (for health checks)
 */
export interface EmailConfigStatus {
  /** Currently configured provider */
  provider: string;
  /** Whether provider is properly configured */
  configured: boolean;
  /** Default sender address */
  from: string;
  /** Sending domain (if applicable) */
  domain?: string;
}
