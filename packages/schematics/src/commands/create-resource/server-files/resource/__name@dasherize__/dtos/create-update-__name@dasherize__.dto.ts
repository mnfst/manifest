import { IsNotEmpty, IsString } from 'class-validator'

export class CreateUpdate<%= classify(name) %>Dto {
  @IsNotEmpty()
  @IsString()
  readonly name: string
}
