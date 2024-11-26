import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common'
import { Rule } from '../../auth/decorators/rule.decorator'
import { AuthService } from '../../auth/auth.service'

import { Request } from 'express'
import { CrudService } from '../services/crud.service'
import { BaseEntity } from '@repo/types'

@Controller('singles')
export class SingleController {
  constructor(
    private readonly authService: AuthService,
    private readonly crudService: CrudService
  ) {}

  @Get(':entity')
  @Rule('read')
  async findOne(
    @Param('entity') entitySlug: string,
    @Req() req: Request
  ): Promise<BaseEntity> {
    const isAdmin: boolean = await this.authService.isReqUserAdmin(req)

    return this.crudService.findOne({
      entitySlug,
      id: 1,
      fullVersion: isAdmin
    })
  }

  @Put(':entity')
  @Rule('update')
  update(
    @Param('entity') entity: string,
    @Body() entityDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.update(entity, 1, entityDto)
  }
}
