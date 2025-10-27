import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'

export class CreateManifestEntityDto {
  @IsString()
  className: string

  @IsString()
  @IsOptional()
  nameSingular: string

  @IsString()
  @IsOptional()
  namePlural: string

  @IsString()
  @IsOptional()
  slug: string

  @IsNumber()
  @IsOptional()
  seedCount: number

  @IsBoolean()
  @IsOptional()
  authenticable: boolean

  @IsBoolean()
  @IsOptional()
  single: boolean
}
