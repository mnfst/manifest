import { IsEmail, IsNotEmpty } from 'class-validator'

export class SignupUserDto {
  @IsNotEmpty()
  @IsEmail()
  public email: string

  @IsNotEmpty()
  public password: string
}
