# Data Model: Backend Email System

**Feature**: 001-email
**Date**: 2026-01-10

## Overview

The email system does not persist email records to the database. Instead, it uses in-memory types and interfaces for email composition, sending, and result tracking. Types are defined in `packages/shared/src/types/email.ts` for cross-package use.

## Core Types

### EmailTemplateType

Enumeration of available email templates.

```typescript
enum EmailTemplateType {
  PASSWORD_RESET = 'password-reset',
  INVITATION = 'invitation',
}
```

### EmailMessage

A composed email ready to send. Created by the email service after template rendering.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| to | string | Yes | Recipient email address |
| from | string | Yes | Sender email address (configured) |
| subject | string | Yes | Email subject line |
| html | string | Yes | Rendered HTML content |
| text | string | No | Plain text fallback content |
| replyTo | string | No | Reply-to address if different from sender |

```typescript
interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}
```

### EmailSendResult

The outcome of an email send attempt.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| success | boolean | Yes | Whether the send succeeded |
| messageId | string | No | Provider-assigned message ID (if successful) |
| error | string | No | Error message (if failed) |
| timestamp | Date | Yes | When the send was attempted |

```typescript
interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}
```

### Template Props Types

Each template type has corresponding props.

#### PasswordResetEmailProps

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userName | string | Yes | User's display name |
| resetLink | string | Yes | Password reset URL with token |
| expiresIn | string | No | Human-readable expiration (default: "1 hour") |

```typescript
interface PasswordResetEmailProps {
  userName: string;
  resetLink: string;
  expiresIn?: string;
}
```

#### InvitationEmailProps

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| inviterName | string | Yes | Name of user who sent invitation |
| appName | string | Yes | Name of the application |
| appLink | string | Yes | Link to access the app |
| personalMessage | string | No | Optional personal message from inviter |

```typescript
interface InvitationEmailProps {
  inviterName: string;
  appName: string;
  appLink: string;
  personalMessage?: string;
}
```

### EmailTemplateProps (Union Type)

Union of all template props for type-safe rendering.

```typescript
type EmailTemplateProps =
  | { type: EmailTemplateType.PASSWORD_RESET } & PasswordResetEmailProps
  | { type: EmailTemplateType.INVITATION } & InvitationEmailProps;
```

## Service Interfaces

### EmailProvider

Abstraction for email sending providers.

```typescript
interface EmailProvider {
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
}
```

**Implementations**:
- `MailgunProvider`: Production provider using Mailgun API
- `ConsoleProvider`: Development provider that logs to console

### TemplateEngine

Abstraction for template rendering.

```typescript
interface TemplateEngine {
  /**
   * Render a template to HTML and plain text
   * @param type - Template type to render
   * @param props - Template-specific props
   * @returns Rendered HTML and text content
   */
  render<T extends Record<string, unknown>>(
    type: EmailTemplateType,
    props: T
  ): Promise<{ html: string; text: string }>;

  /**
   * Get preview HTML for development
   * @param type - Template type to preview
   * @param props - Template-specific props
   * @returns HTML string for browser preview
   */
  preview(type: EmailTemplateType, props: Record<string, unknown>): Promise<string>;

  /**
   * Get list of available templates
   */
  getAvailableTemplates(): EmailTemplateType[];
}
```

**Implementations**:
- `ReactEmailEngine`: Uses @react-email/render to render React components

## DTO Types

### SendEmailDto

Request DTO for sending emails via API (internal use).

```typescript
interface SendEmailDto {
  to: string;
  template: EmailTemplateType;
  props: Record<string, unknown>;
  replyTo?: string;
}
```

### EmailResultDto

Response DTO for email send operations.

```typescript
interface EmailResultDto {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| to | Valid email format | "Invalid email address" |
| resetLink | Valid URL format | "Invalid reset link URL" |
| appLink | Valid URL format | "Invalid app link URL" |
| userName | 1-100 characters | "User name must be 1-100 characters" |
| inviterName | 1-100 characters | "Inviter name must be 1-100 characters" |
| appName | 1-100 characters | "App name must be 1-100 characters" |

## Configuration

Environment variables for email configuration:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| EMAIL_PROVIDER | No | console | Provider to use (console, mailgun) |
| EMAIL_FROM | Yes | - | Default sender email address |
| EMAIL_FROM_NAME | No | - | Sender display name |
| MAILGUN_API_KEY | If mailgun | - | Mailgun API key |
| MAILGUN_DOMAIN | If mailgun | - | Mailgun sending domain |
| MAILGUN_EU_REGION | No | false | Use EU datacenter |
| APP_URL | Yes | - | Base URL for links in emails |

## Type Relationships

```
EmailTemplateType ─────────────────┐
                                   │
PasswordResetEmailProps ───────────┼──▶ TemplateEngine.render()
InvitationEmailProps ──────────────┘           │
                                               ▼
                                         EmailMessage
                                               │
                                               ▼
                                    EmailProvider.send()
                                               │
                                               ▼
                                       EmailSendResult
```
