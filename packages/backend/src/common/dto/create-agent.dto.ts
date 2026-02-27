import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 _-]+$/, { message: 'Agent name must contain only letters, numbers, spaces, dashes, and underscores' })
  name!: string;
}
