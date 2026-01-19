import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { render } from '@react-email/render';
import * as React from 'react';
import {
  EmailTemplateType,
  PasswordResetEmailProps,
  InvitationEmailProps,
  EmailChangeVerificationEmailProps,
} from '@manifest/shared';
import { TemplateEngine, RenderResult } from './template-engine.interface';
import { PasswordResetEmail, getPasswordResetSubject } from '../password-reset';
import { InvitationEmail, getInvitationSubject } from '../invitation';
import { EmailChangeVerificationEmail, getEmailChangeVerificationSubject } from '../email-change-verification';

// Template registry - maps template types to React components
const templateRegistry: Record<EmailTemplateType, React.FC<unknown>> = {
  [EmailTemplateType.PASSWORD_RESET]: PasswordResetEmail as React.FC<unknown>,
  [EmailTemplateType.INVITATION]: InvitationEmail as React.FC<unknown>,
  [EmailTemplateType.EMAIL_CHANGE_VERIFICATION]: EmailChangeVerificationEmail as React.FC<unknown>,
};

// Subject generators - maps template types to subject line functions
const subjectRegistry: Record<
  EmailTemplateType,
  (props: Record<string, unknown>) => string
> = {
  [EmailTemplateType.PASSWORD_RESET]: (props) =>
    getPasswordResetSubject(props.appName as string),
  [EmailTemplateType.INVITATION]: (props) =>
    getInvitationSubject(props.inviterName as string, props.appName as string),
  [EmailTemplateType.EMAIL_CHANGE_VERIFICATION]: (props) =>
    getEmailChangeVerificationSubject(props.appName as string),
};

/**
 * React Email template engine implementation.
 * Renders React Email components to HTML and plain text.
 */
@Injectable()
export class ReactEmailEngine implements TemplateEngine {
  private readonly logger = new Logger(ReactEmailEngine.name);

  async render<T extends Record<string, unknown>>(
    type: EmailTemplateType,
    props: T,
  ): Promise<RenderResult> {
    const Template = templateRegistry[type];

    if (!Template) {
      throw new BadRequestException(`Template not found: ${type}`);
    }

    try {
      // Render to HTML
      const html = await render(React.createElement(Template, props));

      // Render to plain text
      const text = await render(React.createElement(Template, props), {
        plainText: true,
      });

      this.logger.debug(`Rendered template: ${type}`);

      return { html, text };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to render template ${type}: ${errorMessage}`);
      throw new BadRequestException(`Failed to render template: ${errorMessage}`);
    }
  }

  async preview(
    type: EmailTemplateType,
    props: Record<string, unknown>,
  ): Promise<string> {
    const Template = templateRegistry[type];

    if (!Template) {
      throw new BadRequestException(`Template not found: ${type}`);
    }

    try {
      const html = await render(React.createElement(Template, props));
      return html;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to preview template ${type}: ${errorMessage}`);
      throw new BadRequestException(`Failed to preview template: ${errorMessage}`);
    }
  }

  getAvailableTemplates(): EmailTemplateType[] {
    return Object.entries(templateRegistry)
      .filter(([, component]) => component !== null)
      .map(([type]) => type as EmailTemplateType);
  }

  getSubject(type: EmailTemplateType, props: Record<string, unknown>): string {
    const subjectGenerator = subjectRegistry[type];

    if (!subjectGenerator) {
      return 'No Subject';
    }

    return subjectGenerator(props);
  }

  /**
   * Validate props for a specific template type
   */
  validateProps(
    type: EmailTemplateType,
    props: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (type) {
      case EmailTemplateType.PASSWORD_RESET: {
        const p = props as Partial<PasswordResetEmailProps>;
        if (!p.userName || typeof p.userName !== 'string') {
          errors.push('userName is required and must be a string');
        }
        if (!p.resetLink || typeof p.resetLink !== 'string') {
          errors.push('resetLink is required and must be a string');
        }
        break;
      }
      case EmailTemplateType.INVITATION: {
        const p = props as Partial<InvitationEmailProps>;
        if (!p.inviterName || typeof p.inviterName !== 'string') {
          errors.push('inviterName is required and must be a string');
        }
        if (!p.appName || typeof p.appName !== 'string') {
          errors.push('appName is required and must be a string');
        }
        if (!p.appLink || typeof p.appLink !== 'string') {
          errors.push('appLink is required and must be a string');
        }
        break;
      }
      case EmailTemplateType.EMAIL_CHANGE_VERIFICATION: {
        const p = props as Partial<EmailChangeVerificationEmailProps>;
        if (!p.userName || typeof p.userName !== 'string') {
          errors.push('userName is required and must be a string');
        }
        if (!p.newEmail || typeof p.newEmail !== 'string') {
          errors.push('newEmail is required and must be a string');
        }
        if (!p.verificationLink || typeof p.verificationLink !== 'string') {
          errors.push('verificationLink is required and must be a string');
        }
        break;
      }
      default:
        errors.push(`Unknown template type: ${type}`);
    }

    return { valid: errors.length === 0, errors };
  }
}
