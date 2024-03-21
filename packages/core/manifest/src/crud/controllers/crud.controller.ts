import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query
} from '@nestjs/common'

import { Paginator, SelectOption } from '@casejs/types'
import { DeleteResult, InsertResult } from 'typeorm'
import { BaseEntity } from '../../entity/types/base-entity.interface'
import { CrudService } from '../services/crud.service'

@Controller('dynamic')
export class CrudController {
  constructor(private readonly crudService: CrudService) {}

  // @Get('meta')
  // getMeta(): EntityMeta[] {
  //   return this.entityMetaService.getMeta()
  // }

  @Get(':entity')
  findAll(
    @Param('entity') entitySlug: string,
    @Query() queryParams: { [key: string]: string | string[] }
  ): Promise<Paginator<BaseEntity>> {
    return this.crudService.findAll({
      entitySlug,
      queryParams
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
  findOne(
    @Param('entity') entitySlug: string,
    @Param('id', ParseIntPipe) id: number,
    @Query() queryParams: { [key: string]: string | string[] }
  ): Promise<BaseEntity> {
    return this.crudService.findOne({
      entitySlug,
      id,
      queryParams
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
