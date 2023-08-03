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
  UseGuards
} from '@nestjs/common'

import { EntityMeta } from '../../../shared/interfaces/entity-meta.interface'
import { Paginator } from '../../../shared/interfaces/paginator.interface'
import { SelectOption } from '../../../shared/interfaces/select-option.interface'
import { AuthGuard } from '../auth/auth.guard'
import { DynamicEntityService } from './dynamic-entity.service'

@Controller('dynamic')
@UseGuards(AuthGuard)
export class DynamicEntityController {
  constructor(private readonly dynamicEntityService: DynamicEntityService) {}

  @Get('meta')
  getMeta(): Promise<EntityMeta[]> {
    return this.dynamicEntityService.getMeta()
  }

  @Get(':entity')
  findAll(
    @Param('entity') entity: string,
    @Query() queryParams: { [key: string]: string | string[] }
  ): Promise<Paginator<any>> {
    return this.dynamicEntityService.findAll({
      entitySlug: entity,
      queryParams,
      options: { paginated: true }
    }) as Promise<Paginator<any>>
  }

  @Get(':entity/select-options')
  findSelectOptions(@Param('entity') entity: string): Promise<SelectOption[]> {
    return this.dynamicEntityService.findSelectOptions(entity)
  }

  @Get(':entity/:id')
  findOne(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<any> {
    return this.dynamicEntityService.findOne(entity, id)
  }

  @Post(':entity')
  store(@Param('entity') entity: string, @Body() entityDto: any): Promise<any> {
    return this.dynamicEntityService.store(entity, entityDto)
  }

  @Put(':entity/:id')
  update(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() entityDto: any
  ): Promise<any> {
    return this.dynamicEntityService.update(entity, id, entityDto)
  }

  @Delete(':entity/:id')
  delete(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<any> {
    return this.dynamicEntityService.delete(entity, id)
  }
}
