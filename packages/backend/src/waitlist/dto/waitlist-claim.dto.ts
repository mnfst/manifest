import { IsEmail } from 'class-validator';

export class WaitlistClaimDto {
  @IsEmail()
  email!: string;
}
