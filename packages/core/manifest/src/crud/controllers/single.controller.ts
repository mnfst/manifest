import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Put,
  Req,
  UseGuards
} from '@nestjs/common'
import { Rule } from '../../auth/decorators/rule.decorator'
import { AuthService } from '../../auth/auth.service'

import { Request } from 'express'
import { CrudService } from '../services/crud.service'
import { BaseEntity } from '@repo/types'
import { IsSingleGuard } from '../guards/is-single.guard'
import { AuthorizationGuard } from '../../auth/guards/authorization.guard'

/**
 * Controller for single type entities.
 */
@UseGuards(AuthorizationGuard, IsSingleGuard)
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

    let singleItem: BaseEntity

    try {
      singleItem = await this.crudService.findOne({
        entitySlug,
        id: 1,
        fullVersion: isAdmin
      })
    } catch (e) {
      if (e instanceof NotFoundException) {
        singleItem = await this.crudService.storeEmpty(entitySlug)
      }
    }

    return singleItem
  }

  @Put(':entity')
  @Rule('update')
  put(
    @Param('entity') entitySlug: string,
    @Body() itemDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.update({ entitySlug, id: 1, itemDto })
  }

  @Patch(':entity')
  @Rule('update')
  patch(
    @Param('entity') entitySlug: string,
    @Body() itemDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.update({
      entitySlug,
      id: 1,
      itemDto,
      partialReplacement: true
    })
  }
}
