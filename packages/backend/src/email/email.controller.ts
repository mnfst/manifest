import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { EmailTemplateType } from '@chatgpt-app-builder/shared';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Preview an email template without sending (development only)
   * GET /email/preview/:template
   *
   * This endpoint is useful for testing email templates during development.
   * In production, consider disabling this endpoint or protecting it.
   */
  @Get('preview/:template')
  async previewTemplate(
    @Param('template') template: string,
    @Query() props: Record<string, string>,
  ): Promise<string> {
    // Validate template type
    if (!Object.values(EmailTemplateType).includes(template as EmailTemplateType)) {
      throw new BadRequestException(`Invalid template type: ${template}`);
    }

    // Provide default props if none are provided (for easy testing)
    const defaultProps = this.getDefaultPropsForTemplate(template as EmailTemplateType);
    const mergedProps = { ...defaultProps, ...props };

    return this.emailService.previewTemplate(template as EmailTemplateType, mergedProps);
  }

  /**
   * Get default props for a template type (for easy preview testing)
   */
  private getDefaultPropsForTemplate(
    template: EmailTemplateType,
  ): Record<string, unknown> {
    switch (template) {
      case EmailTemplateType.PASSWORD_RESET:
        return {
          userName: 'John Doe',
          resetLink: 'https://example.com/reset?token=sample-token-123',
          expiresIn: '1 hour',
          appName: 'Manifest',
        };
      case EmailTemplateType.INVITATION:
        return {
          inviterName: 'Jane Smith',
          appName: 'Manifest',
          appLink: 'https://example.com/invite?code=sample-code-456',
        };
      default:
        return {};
    }
  }
}
