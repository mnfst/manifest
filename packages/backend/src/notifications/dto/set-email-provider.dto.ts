import { IsString, IsIn } from 'class-validator';

export class SetEmailProviderDto {
  @IsString()
  @IsIn(['resend', 'mailgun'])
  provider!: string;

  @IsString()
  apiKey!: string;

  @IsString()
  domain!: string;
}
