import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put
} from '@nestjs/common'
import { DynamicEntityService } from './dynamic-entity.service'

@Controller('dynamic')
export class DynamicEntityController {
  constructor(private readonly dynamicEntityService: DynamicEntityService) {}

  @Get(':entity')
  findAll(@Param('entity') entity: string) {
    return this.dynamicEntityService.findAll(entity)
  }

  @Get(':entity/:id')
  findOne(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.dynamicEntityService.findOne(entity, id)
  }

  @Post(':entity')
  store(@Param('entity') entity: string, @Body() entityDto: any) {
    return this.dynamicEntityService.store(entity, entityDto)
  }

  @Put(':entity/:id')
  update(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() entityDto: any
  ) {
    return this.dynamicEntityService.update(entity, id, entityDto)
  }

  @Delete(':entity/:id')
  delete(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.dynamicEntityService.delete(entity, id)
  }
}
