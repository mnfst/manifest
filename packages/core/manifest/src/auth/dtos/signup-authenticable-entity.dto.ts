import { IsEmail, IsNotEmpty } from 'class-validator'

export class SignupAuthenticableEntityDto {
  @IsNotEmpty()
  @IsEmail()
  public email: string

  @IsNotEmpty()
  public password: string
}
