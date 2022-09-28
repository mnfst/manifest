import { IsNotEmpty, IsString, IsOptional } from 'class-validator'

export class CreateUpdateRoleDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string

  @IsNotEmpty()
  @IsString()
  readonly displayName: string

  @IsOptional()
  readonly permissionIds: number[]
}
