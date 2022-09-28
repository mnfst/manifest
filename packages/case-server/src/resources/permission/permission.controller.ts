import { Controller, Get } from '@nestjs/common'
import { CasePermission } from '../interfaces/case-permission.interface'
import { PermissionService } from './permission.service'

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  async index(): Promise<CasePermission[]> {
    return this.permissionService.index()
  }
}
