import { EmailTemplateType } from '@chatgpt-app-builder/shared';

/**
 * Result of template rendering
 */
export interface RenderResult {
  /** Rendered HTML content */
  html: string;
  /** Plain text fallback content */
  text: string;
}

/**
 * Interface for email template rendering engines.
 * Implementations handle rendering templates to HTML and plain text.
 */
export interface TemplateEngine {
  /**
   * Render a template to HTML and plain text
   * @param type - Template type to render
   * @param props - Template-specific props
   * @returns Rendered HTML and text content
   */
  render<T extends Record<string, unknown>>(
    type: EmailTemplateType,
    props: T,
  ): Promise<RenderResult>;

  /**
   * Get preview HTML for development
   * @param type - Template type to preview
   * @param props - Template-specific props
   * @returns HTML string for browser preview
   */
  preview(
    type: EmailTemplateType,
    props: Record<string, unknown>,
  ): Promise<string>;

  /**
   * Get list of available templates
   */
  getAvailableTemplates(): EmailTemplateType[];

  /**
   * Get the subject line for a template
   * @param type - Template type
   * @param props - Template-specific props (may affect subject)
   */
  getSubject(type: EmailTemplateType, props: Record<string, unknown>): string;
}

/**
 * Injection token for template engine
 */
export const TEMPLATE_ENGINE = 'TEMPLATE_ENGINE';
