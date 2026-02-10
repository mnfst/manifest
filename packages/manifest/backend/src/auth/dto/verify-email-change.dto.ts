import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for verifying an email change using a token
 */
export class VerifyEmailChangeDto {
  @IsNotEmpty({ message: 'Verification token is required' })
  @IsString()
  token!: string;
}
