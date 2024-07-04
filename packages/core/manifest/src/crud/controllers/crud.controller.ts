import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req
} from '@nestjs/common'

import { BaseEntity, Paginator, SelectOption } from '@mnfst/types'
import { DeleteResult, InsertResult } from 'typeorm'
import { CrudService } from '../services/crud.service'
import { AuthService } from '../../auth/auth.service'
import { Request } from 'express'

@Controller('dynamic')
export class CrudController {
  constructor(
    private readonly crudService: CrudService,
    private readonly authService: AuthService
  ) {}

  @Get('/:entity')
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
  store(
    @Param('entity') entity: string,
    @Body() entityDto: any
  ): Promise<InsertResult> {
    return this.crudService.store(entity, entityDto)
  }

  @Put(':entity/:id')
  update(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() entityDto: any
  ): Promise<BaseEntity> {
    return this.crudService.update(entity, id, entityDto)
  }

  @Delete(':entity/:id')
  delete(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<DeleteResult> {
    return this.crudService.delete(entity, id)
  }
}
