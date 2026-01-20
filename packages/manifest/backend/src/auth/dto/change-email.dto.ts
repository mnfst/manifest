import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for requesting an email change
 */
export class ChangeEmailDto {
  @IsNotEmpty({ message: 'New email is required' })
  @IsString()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  newEmail!: string;
}
