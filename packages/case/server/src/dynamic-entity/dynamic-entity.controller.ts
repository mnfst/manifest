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

import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { DeleteResult } from 'typeorm'
import { EntityMeta } from '../../../shared/interfaces/entity-meta.interface'
import { Paginator } from '../../../shared/interfaces/paginator.interface'
import { SelectOption } from '../../../shared/interfaces/select-option.interface'
import { ApiRestrictionGuard } from '../auth/api-restriction.guard'
import { EndpointRestrictionRule } from '../decorators/endpoint-restriction-rule.decorator'
import { DynamicEntityService } from './dynamic-entity.service'

@Controller('dynamic')
@UseGuards(ApiRestrictionGuard)
@ApiBearerAuth('JWT')
@ApiTags('Dynamic entities')
export class DynamicEntityController {
  constructor(private readonly dynamicEntityService: DynamicEntityService) {}

  @Get('meta')
  @ApiOperation({
    summary: 'Get metadata of all entities of the app'
  })
  getMeta(): Promise<EntityMeta[]> {
    return this.dynamicEntityService.getMeta()
  }

  @Get(':entity')
  @EndpointRestrictionRule('read')
  @ApiOperation({
    summary: 'Find all items of an entity'
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity slug',
    example: 'cats, posts, corporation-groups...'
  })
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
  @ApiOperation({
    summary: 'Get a lite version of all items of an entity (identifier + id)'
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity slug',
    example: 'cats, posts, corporation-groups...'
  })
  findSelectOptions(@Param('entity') entity: string): Promise<SelectOption[]> {
    return this.dynamicEntityService.findSelectOptions(entity)
  }

  @Get(':entity/:id')
  @EndpointRestrictionRule('read')
  @ApiOperation({
    summary: 'Find one item of an entity'
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity slug',
    example: 'cats, posts, corporation-groups...'
  })
  @ApiParam({
    name: 'id',
    description: 'id of the item',
    example: '15, 25, 36...'
  })
  findOne(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<any> {
    return this.dynamicEntityService.findOne(entity, id)
  }

  @Post(':entity')
  @EndpointRestrictionRule('create')
  @ApiOperation({
    summary: 'Create a new item of an entity'
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity slug',
    example: 'cats, posts, corporation-groups...'
  })
  store(@Param('entity') entity: string, @Body() entityDto: any): Promise<any> {
    return this.dynamicEntityService.store(entity, entityDto)
  }

  @Put(':entity/:id')
  @EndpointRestrictionRule('update')
  @ApiOperation({
    summary: 'Update an item of an entity'
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity slug',
    example: 'cats, posts, corporation-groups...'
  })
  @ApiParam({
    name: 'id',
    description: 'id of the item',
    example: '15, 25, 36...'
  })
  update(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() entityDto: any
  ): Promise<any> {
    return this.dynamicEntityService.update(entity, id, entityDto)
  }

  @Delete(':entity/:id')
  @EndpointRestrictionRule('delete')
  @ApiOperation({
    summary: 'Delete an item of an entity'
  })
  @ApiParam({
    name: 'entity',
    description: 'Entity slug',
    example: 'cats, posts, corporation-groups...'
  })
  @ApiParam({
    name: 'id',
    description: 'id of the item',
    example: '15, 25, 36...'
  })
  delete(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<DeleteResult> {
    return this.dynamicEntityService.delete(entity, id)
  }
}
