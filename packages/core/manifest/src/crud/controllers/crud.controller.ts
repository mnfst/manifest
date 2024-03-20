import { Controller, Get, Param, Query } from '@nestjs/common'

import { Paginator } from '@casejs/types'
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
    @Param('entity') entity: string,
    @Query() queryParams: { [key: string]: string | string[] }
  ): Promise<Paginator<BaseEntity>> {
    return this.crudService.findAll({
      entitySlug: entity,
      queryParams
    })
  }

  // @Get(':entity/select-options')
  // findSelectOptions(
  //   @Param('entity') entity: string
  // ): Promise<{ label: string; id: number }[]> {
  //   return this.crudService.findSelectOptions(entity)
  // }

  // @Get(':entity/:id')
  // findOne(
  //   @Param('entity') entity: string,
  //   @Param('id', ParseIntPipe) id: number
  // ): Promise<BaseEntity> {
  //   return this.crudService.findOne(entity, id)
  // }

  // @Post(':entity')
  // store(
  //   @Param('entity') entity: string,
  //   @Body() entityDto: any
  // ): Promise<InsertResult> {
  //   return this.crudService.store(entity, entityDto)
  // }

  // @Put(':entity/:id')
  // update(
  //   @Param('entity') entity: string,
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() entityDto: any
  // ): Promise<BaseEntity> {
  //   return this.crudService.update(entity, id, entityDto)
  // }

  // @Delete(':entity/:id')
  // delete(
  //   @Param('entity') entity: string,
  //   @Param('id', ParseIntPipe) id: number
  // ): Promise<DeleteResult> {
  //   return this.crudService.delete(entity, id)
  // }
}
