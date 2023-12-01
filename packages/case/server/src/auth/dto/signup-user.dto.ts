import { IsEmail, IsNotEmpty } from 'class-validator'

export class SignupUserDto {
  @IsEmail()
  public email: string

  @IsNotEmpty()
  public password: string
}
