import {
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
  IsArray
} from 'class-validator'
import { AccessPolicy } from '../../../../types/src'

export class CreateUpdatePolicyManifestDto {
  @IsNotEmpty()
  @IsIn(['public', 'restricted', 'forbidden', 'admin'])
  access: AccessPolicy

  @IsOptional()
  @ValidateIf((o) => typeof o.allow === 'string')
  @IsString()
  @ValidateIf((o) => Array.isArray(o.allow))
  @IsArray()
  @IsString({ each: true })
  allow?: string | string[]

  @IsOptional()
  @IsString()
  condition?: 'self'
}
