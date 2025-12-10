import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class SignupAuthenticableEntityDto {
  @IsEmail()
  @IsNotEmpty()
  public email: string

  @IsString()
  @IsNotEmpty()
  public password: string
}
