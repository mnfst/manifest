import { IsEmail, IsNotEmpty } from 'class-validator'

export class SignupAuthenticableEntityDto {
  @IsEmail()
  public email: string

  @IsNotEmpty()
  public password: string
}
