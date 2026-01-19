import { IsEmail, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { EmailTemplateType } from '@manifest/shared';

/**
 * DTO for sending emails via the API
 */
export class SendEmailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  to!: string;

  @IsEnum(EmailTemplateType, { message: 'Invalid template type' })
  template!: EmailTemplateType;

  @IsObject({ message: 'Props must be an object' })
  props!: Record<string, unknown>;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid reply-to email address' })
  replyTo?: string;
}

/**
 * DTO for password reset email props validation
 */
export class PasswordResetPropsDto {
  @IsString({ message: 'User name must be a string' })
  userName!: string;

  @IsString({ message: 'Reset link must be a string' })
  resetLink!: string;

  @IsOptional()
  @IsString({ message: 'Expires in must be a string' })
  expiresIn?: string;
}

/**
 * DTO for invitation email props validation
 */
export class InvitationPropsDto {
  @IsString({ message: 'Inviter name must be a string' })
  inviterName!: string;

  @IsString({ message: 'App name must be a string' })
  appName!: string;

  @IsString({ message: 'App link must be a string' })
  appLink!: string;

  @IsOptional()
  @IsString({ message: 'Personal message must be a string' })
  personalMessage?: string;
}
