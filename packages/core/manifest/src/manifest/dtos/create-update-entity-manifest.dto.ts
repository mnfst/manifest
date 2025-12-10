import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { CreateUpdatePropertyManifestDto } from './create-update-property-manifest.dto'
import { Type } from 'class-transformer'
import { CreateUpdatePolicyManifestDto } from './create-update-policy-manifest.dto'

export class CreateUpdateEntityManifestDto {
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

  @ValidateNested({ each: true })
  @Type(() => CreateUpdatePropertyManifestDto)
  @IsOptional()
  properties?: CreateUpdatePropertyManifestDto[]

  @ValidateNested({ each: true })
  @Type(() => CreateUpdatePolicyManifestDto)
  @IsOptional()
  policies?: {
    create?: CreateUpdatePolicyManifestDto[]
    read?: CreateUpdatePolicyManifestDto[]
    write?: CreateUpdatePolicyManifestDto[]
    delete?: CreateUpdatePolicyManifestDto[]
  }
}
