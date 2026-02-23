import { IsEmail } from 'class-validator';

export class SaveNotificationEmailDto {
  @IsEmail()
  email!: string;
}
