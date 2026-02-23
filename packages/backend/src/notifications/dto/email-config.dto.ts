import { IsString, IsIn, IsOptional, IsEmail } from 'class-validator';

export class SaveEmailConfigDto {
  @IsIn(['mailgun', 'sendgrid', 'resend'])
  provider!: 'mailgun' | 'sendgrid' | 'resend';

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;
}

export class TestEmailDto {
  @IsEmail()
  to!: string;

  @IsIn(['mailgun', 'sendgrid', 'resend'])
  provider!: 'mailgun' | 'sendgrid' | 'resend';

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;
}
