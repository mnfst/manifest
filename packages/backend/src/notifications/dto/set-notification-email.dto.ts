import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class SetNotificationEmailDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;
}
