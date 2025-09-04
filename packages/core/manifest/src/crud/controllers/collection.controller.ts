import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpException,
  HttpStatus
} from '@nestjs/common'

import { BaseEntity, Paginator, SelectOption } from '@repo/types'
import { CrudService } from '../services/crud.service'
import { AuthService } from '../../auth/auth.service'
import { Request } from 'express'
import { PolicyGuard } from '../../policy/policy.guard'
import { Rule } from '../../policy/decorators/rule.decorator'
import { IsCollectionGuard } from '../guards/is-collection.guard'
import { HookInterceptor } from '../../hook/hook.interceptor'
import { ADMIN_ENTITY_MANIFEST, COLLECTIONS_PATH } from '../../constants'
import { MiddlewareInterceptor } from '../../middleware/middleware.interceptor'
import { IsAdminGuard } from '../../auth/guards/is-admin.guard'

@Controller(COLLECTIONS_PATH)
@UseGuards(PolicyGuard, IsCollectionGuard)
@UseInterceptors(HookInterceptor, MiddlewareInterceptor)
export class CollectionController {
  constructor(
    private readonly crudService: CrudService,
    private readonly authService: AuthService
  ) {}

  @Get('/:entity')
  @Rule('read')
  async findAll(
    @Param('entity') entitySlug: string,
    @Query() queryParams: { [key: string]: string | string[] },
    @Req() req: Request
  ): Promise<Paginator<BaseEntity>> {
    const isAdmin: boolean = await this.authService.isReqUserAdmin(req)

    return this.crudService.findAll({
      entitySlug,
      queryParams,
      fullVersion: isAdmin
    })
  }

  /**
   * Get select options for a specific entity. This is used for select inputs in admin panel forms.
   * This is why we use the `IsAdminGuard` here.
   *
   * @param entitySlug The slug of the entity.
   * @param queryParams The query parameters to filter the select options.
   *
   * @returns The select options for the entity.
   */
  @Get(':entity/select-options')
  @UseGuards(IsAdminGuard)
  findSelectOptions(
    @Param('entity') entitySlug: string,
    @Query() queryParams: { [key: string]: string | string[] }
  ): Promise<SelectOption[]> {
    return this.crudService.findSelectOptions({
      entitySlug,
      queryParams
    })
  }

  @Get(':entity/:id')
  @Rule('read')
  async findOne(
    @Param('entity') entitySlug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() queryParams: { [key: string]: string | string[] },
    @Req() req: Request
  ): Promise<BaseEntity> {
    const isAdmin: boolean = await this.authService.isReqUserAdmin(req)

    return this.crudService.findOne({
      entitySlug,
      id,
      queryParams,
      fullVersion: isAdmin
    })
  }

  @Post(':entity')
  @Rule('create')
  store(
    @Param('entity') entity: string,
    @Body() entityDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.store(entity, entityDto)
  }

  @Put(':entity/:id')
  @Rule('update')
  put(
    @Param('entity') entitySlug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() itemDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.update({ entitySlug, id, itemDto })
  }

  @Patch(':entity/:id')
  @Rule('update')
  patch(
    @Param('entity') entitySlug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() itemDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.update({
      entitySlug,
      id,
      itemDto,
      partialReplacement: true
    })
  }

  @Delete(':entity/:id')
  @Rule('delete')
  async delete(
    @Param('entity') entity: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request
  ): Promise<BaseEntity> {
    // Prevent an admin from deleting their own account
    if (entity === ADMIN_ENTITY_MANIFEST.slug) {
      const requestUser = await this.authService.getUserFromRequest(req)
      if (requestUser?.user?.id === id) {
        throw new HttpException(
          'You cannot delete your own admin account.',
          HttpStatus.FORBIDDEN
        )
      }
    }

    return this.crudService.delete(entity, id)
  }
}
