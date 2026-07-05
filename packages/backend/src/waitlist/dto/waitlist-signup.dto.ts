import { IsEmail } from 'class-validator';

export class WaitlistSignupDto {
  @IsEmail()
  email!: string;
}
