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

import { Paginator } from '@casejs/types'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { DeleteResult, InsertResult } from 'typeorm'
import { EntityMeta } from '../../../../shared/interfaces/entity-meta.interface'
import { SelectOption } from '../../../../shared/interfaces/select-option.interface'
import { ApiRestrictionGuard } from '../../api/api-restriction.guard'
import { BaseEntity } from '../../core-entities/base-entity'
import { EndpointRestrictionRule } from '../decorators/endpoint-restriction-rule.decorator'
import { CrudService } from '../services/crud.service'
import { EntityMetaService } from '../services/entity-meta.service'

@Controller('dynamic')
@UseGuards(ApiRestrictionGuard)
@ApiBearerAuth('JWT')
@ApiTags('Dynamic entities')
export class CrudController {
  constructor(
    private readonly crudService: CrudService,
    private readonly entityMetaService: EntityMetaService
  ) {}

  @Get('meta')
  @ApiOperation({
    summary: 'Get metadata of all entities of the app'
  })
  getMeta(): EntityMeta[] {
    return this.entityMetaService.getMeta()
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
  ): Promise<Paginator<BaseEntity> | BaseEntity[] | string> {
    return this.crudService.findAll({
      entitySlug: entity,
      queryParams
    }) as Promise<Paginator<BaseEntity>>
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
    return this.crudService.findSelectOptions(entity)
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
  ): Promise<BaseEntity> {
    return this.crudService.findOne(entity, id)
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
  store(
    @Param('entity') entity: string,
    @Body() entityDto: any
  ): Promise<InsertResult> {
    return this.crudService.store(entity, entityDto)
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
  ): Promise<BaseEntity> {
    return this.crudService.update(entity, id, entityDto)
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
    return this.crudService.delete(entity, id)
  }
}
