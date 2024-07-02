import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty } from 'class-validator'

export class SignupAuthenticableEntityDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'admin@manifest.build'
  })
  @IsNotEmpty()
  @IsEmail()
  public email: string

  @ApiProperty({
    description: 'The password of the user',
    example: 'admin'
  })
  @IsNotEmpty()
  public password: string
}
