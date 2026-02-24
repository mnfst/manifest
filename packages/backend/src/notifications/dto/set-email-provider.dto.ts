import { IsString, IsIn, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SetEmailProviderDto {
  @IsString()
  @IsIn(['resend', 'mailgun'])
  provider!: string;

  @IsString()
  @MinLength(8)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  apiKey!: string;

  @IsString()
  @MinLength(1)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  domain!: string;
}

export class TestEmailProviderDto {
  @IsString()
  @IsIn(['resend', 'mailgun'])
  provider!: string;

  @IsString()
  @MinLength(8)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  apiKey!: string;

  @IsString()
  @MinLength(1)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  domain!: string;

  @IsString()
  to!: string;
}
