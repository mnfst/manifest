import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO for changing user password
 */
export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Current password is required' })
  @IsString()
  currentPassword!: string;

  @IsNotEmpty({ message: 'New password is required' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  newPassword!: string;

  @IsOptional()
  @IsBoolean()
  revokeOtherSessions?: boolean;
}
