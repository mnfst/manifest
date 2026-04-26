import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBaselineDto {
  @IsNotEmpty()
  @IsString()
  agent_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  model_id!: string | null;
}
