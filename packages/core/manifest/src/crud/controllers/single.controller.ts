import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Put,
  Req,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { Rule } from '../../policy/decorators/rule.decorator'
import { AuthService } from '../../auth/auth.service'

import { Request } from 'express'
import { CrudService } from '../services/crud.service'
import { BaseEntity } from '@repo/types'
import { IsSingleGuard } from '../guards/is-single.guard'
import { PolicyGuard } from '../../policy/policy.guard'
import { HookInterceptor } from '../../hook/hook.interceptor'
import { SINGLES_PATH } from '../../constants'
import { MiddlewareInterceptor } from '../../middleware/middleware.interceptor'

/**
 * Controller for single type entities.
 */
@UseGuards(PolicyGuard, IsSingleGuard)
@UseInterceptors(HookInterceptor)
@UseInterceptors(HookInterceptor, MiddlewareInterceptor)
@Controller(SINGLES_PATH)
export class SingleController {
  constructor(
    private readonly authService: AuthService,
    private readonly crudService: CrudService
  ) {}

  /**
   * Get a single item of a specific single type entity.
   * If the item does not exist, it will create a new one.
   *
   * @param entitySlug The slug of the entity.
   * @param req The request object.
   *
   * @returns The single item of the entity.
   */
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
    return this.crudService.update({ entitySlug, itemDto })
  }

  @Patch(':entity')
  @Rule('update')
  patch(
    @Param('entity') entitySlug: string,
    @Body() itemDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.update({
      entitySlug,
      itemDto,
      partialReplacement: true
    })
  }
}
