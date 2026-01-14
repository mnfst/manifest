import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for updating user profile (firstName, lastName)
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'First name must not be empty' })
  @MaxLength(100, { message: 'First name must be at most 100 characters' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Last name must not be empty' })
  @MaxLength(100, { message: 'Last name must be at most 100 characters' })
  lastName?: string;

  /**
   * Custom validation: At least one of firstName or lastName must be provided
   * This is handled at the service level since class-validator doesn't easily support this
   */
}
