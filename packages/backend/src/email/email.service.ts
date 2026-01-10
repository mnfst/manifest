import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailTemplateType,
  EmailSendResult,
  PasswordResetEmailProps,
  InvitationEmailProps,
} from '@chatgpt-app-builder/shared';
import { EmailProvider, EMAIL_PROVIDER } from './providers/email-provider.interface';
import { TemplateEngine, TEMPLATE_ENGINE } from './templates/engine/template-engine.interface';
import { ReactEmailEngine } from './templates/engine/react-email.engine';

/**
 * Options for sending an email
 */
interface SendEmailOptions {
  to: string;
  template: EmailTemplateType;
  props: Record<string, unknown>;
  replyTo?: string;
}

/**
 * Email service - orchestrates template rendering and email sending.
 * This is the main entry point for sending emails in the application.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    @Inject(TEMPLATE_ENGINE) private readonly templateEngine: TemplateEngine,
    private readonly configService: ConfigService,
  ) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@example.com');
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'Manifest');
  }

  /**
   * Send a password reset email
   */
  async sendPasswordReset(
    to: string,
    props: PasswordResetEmailProps,
  ): Promise<EmailSendResult> {
    this.validateEmail(to);

    this.logger.log(`Sending password reset email to ${to}`);

    return this.send({
      to,
      template: EmailTemplateType.PASSWORD_RESET,
      props: { ...props, appName: this.fromName },
    });
  }

  /**
   * Send an invitation email
   */
  async sendInvitation(
    to: string,
    props: InvitationEmailProps,
  ): Promise<EmailSendResult> {
    this.validateEmail(to);

    this.logger.log(`Sending invitation email to ${to} from ${props.inviterName}`);

    return this.send({
      to,
      template: EmailTemplateType.INVITATION,
      props,
    });
  }

  /**
   * Generic send method for any template type
   */
  async send(options: SendEmailOptions): Promise<EmailSendResult> {
    const { to, template, props, replyTo } = options;

    this.validateEmail(to);

    // Validate props for the template if the engine supports it
    if ('validateProps' in this.templateEngine && typeof this.templateEngine.validateProps === 'function') {
      const validation = (this.templateEngine as ReactEmailEngine).validateProps(template, props);
      if (!validation.valid) {
        this.logger.error(`Invalid props for template ${template}: ${validation.errors.join(', ')}`);
        throw new BadRequestException(`Invalid email props: ${validation.errors.join(', ')}`);
      }
    }

    this.logger.log(`Preparing to send ${template} email to ${to}`);

    try {
      // Render the template
      const { html, text } = await this.templateEngine.render(template, props);
      const subject = this.templateEngine.getSubject(template, props);

      // Send the email
      const result = await this.provider.send({
        to,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject,
        html,
        text,
        replyTo,
      });

      if (result.success) {
        this.logger.log(`Email sent successfully to ${to}, messageId: ${result.messageId}`);
      } else {
        this.logger.error(`Failed to send email to ${to}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error sending email to ${to}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get available email templates
   */
  getAvailableTemplates(): EmailTemplateType[] {
    return this.templateEngine.getAvailableTemplates();
  }

  /**
   * Preview a template without sending
   */
  async previewTemplate(
    template: EmailTemplateType,
    props: Record<string, unknown>,
  ): Promise<string> {
    return this.templateEngine.preview(template, props);
  }

  /**
   * Check if the email provider is configured
   */
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Get the provider name
   */
  getProviderName(): string {
    return this.provider.getName();
  }

  /**
   * Get configuration status
   */
  getConfigStatus() {
    return {
      provider: this.provider.getName(),
      configured: this.provider.isConfigured(),
      from: this.fromEmail,
      domain: this.configService.get<string>('MAILGUN_DOMAIN'),
    };
  }

  /**
   * Validate email address format
   */
  private validateEmail(email: string): void {
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException(`Invalid email address: ${email}`);
    }
  }
}
