import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { PropType } from '../../../../types/src'

export class CreateUpdatePropertyManifestDto {
  @IsString()
  name: string

  @IsString()
  @IsOptional()
  label: string

  @IsEnum(PropType)
  @IsOptional()
  type: PropType

  @IsString()
  @IsOptional()
  helpText: string

  @IsOptional()
  default: any

  @IsBoolean()
  @IsOptional()
  hidden: boolean

  // TODO: Validation nested DTO
  // TODO: Property Options nested DTOs
}
