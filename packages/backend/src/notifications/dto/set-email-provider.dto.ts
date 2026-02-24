import { IsString, IsIn, MinLength, IsOptional, IsEmail, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class SetEmailProviderDto {
  @IsString()
  @IsIn(['resend', 'mailgun', 'sendgrid'])
  provider!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  apiKey?: string;

  @ValidateIf((o) => o.provider === 'mailgun')
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  domain?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  notificationEmail?: string;
}

export class TestEmailProviderDto {
  @IsString()
  @IsIn(['resend', 'mailgun', 'sendgrid'])
  provider!: string;

  @IsString()
  @MinLength(8)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  apiKey!: string;

  @ValidateIf((o) => o.provider === 'mailgun')
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  domain?: string;

  @IsString()
  to!: string;
}
