import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'

import { BaseEntity, Paginator, SelectOption } from '@repo/types'
import { CrudService } from '../services/crud.service'
import { AuthService } from '../../auth/auth.service'
import { Request } from 'express'
import { PolicyGuard } from '../../policy/policy.guard'
import { Rule } from '../../policy/decorators/rule.decorator'
import { IsCollectionGuard } from '../guards/is-collection.guard'
import { HookInterceptor } from '../../hook/hook.interceptor'
import { COLLECTIONS_PATH } from '../../constants'

@Controller(COLLECTIONS_PATH)
@UseGuards(PolicyGuard, IsCollectionGuard)
@UseInterceptors(HookInterceptor)
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

  @Get(':entity/select-options')
  @Rule('read')
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
    @Param('id', ParseIntPipe) id: number,
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
    @Param('id', ParseIntPipe) id: number,
    @Body() itemDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    return this.crudService.update({ entitySlug, id, itemDto })
  }

  @Patch(':entity/:id')
  @Rule('update')
  patch(
    @Param('entity') entitySlug: string,
    @Param('id', ParseIntPipe) id: number,
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
  delete(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<BaseEntity> {
    return this.crudService.delete(entity, id)
  }
}
