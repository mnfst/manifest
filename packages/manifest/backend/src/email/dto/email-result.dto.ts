/**
 * Response DTO for email send operations
 */
export class EmailResultDto {
  success!: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Response DTO for email configuration status
 */
export class EmailConfigStatusDto {
  provider!: string;
  configured!: boolean;
  from!: string;
  domain?: string;
}

/**
 * Response DTO for available templates
 */
export class EmailTemplatesDto {
  templates!: string[];
}
