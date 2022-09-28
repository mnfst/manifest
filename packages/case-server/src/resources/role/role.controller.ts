import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common'
import { RoleService } from './role.service'

import { CreateUpdateRoleDto } from './dtos/create-update-role.dto'
import { DeleteResult, UpdateResult } from 'typeorm'
import { Permission } from '../../decorators/permission.decorator'
import { Paginator } from '../../interfaces/paginator.interface'
import { CaseRole } from '../interfaces/case-role.interface'
import { AuthGuard } from '../../guards/auth.guard'
import { SelectOption } from '../../interfaces/select-option.interface'

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @Permission('browseRoles')
  async index(
    @Query('page') page: string,
    @Query('withoutPagination') withoutPagination: string
  ): Promise<Paginator<CaseRole> | CaseRole[]> {
    return this.roleService.index({
      page,
      withoutPagination
    })
  }

  @Get('select-options')
  @UseGuards(AuthGuard)
  async listSelectOptions(): Promise<SelectOption[]> {
    const roles: CaseRole[] = (await this.roleService.index({
      withoutPagination: 'true'
    })) as CaseRole[]

    return roles.map((r: CaseRole) => ({
      label: r.displayName,
      value: r.id.toString()
    }))
  }

  @Get('/:id')
  @Permission('readRoles')
  async show(@Param('id', ParseIntPipe) id: number): Promise<CaseRole> {
    return this.roleService.show(id)
  }

  @Post()
  @Permission('addRoles')
  async store(@Body() roleDto: CreateUpdateRoleDto): Promise<CaseRole> {
    return this.roleService.store(roleDto)
  }

  @Put('/:id')
  @Permission('editRoles')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() roleDto: CreateUpdateRoleDto
  ): Promise<UpdateResult> {
    return this.roleService.update(id, roleDto)
  }

  @Delete('/:id')
  @Permission('deleteRoles')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
    return this.roleService.destroy(id)
  }
}
