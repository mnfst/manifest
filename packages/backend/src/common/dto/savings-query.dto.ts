import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class SavingsQueryDto {
  @IsIn(['1h', '6h', '24h', '7d', '30d'])
  range!: string;

  @IsNotEmpty()
  @IsString()
  agent_name!: string;
}
