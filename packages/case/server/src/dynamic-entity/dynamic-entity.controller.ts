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

/**
 * Controller for handling dynamic entities
 * @class DynamicEntityController
 */
@Controller('dynamic')
@UseGuards(AuthGuard)
export class DynamicEntityController {
  /**
   * Constructor for the DynamicEntityController class
   * @param {DynamicEntityService} dynamicEntityService - Service for handling dynamic entities
   */
  constructor(private readonly dynamicEntityService: DynamicEntityService) {}

  /**
   * Endpoint to get metadata of all entities
   * @returns {Promise<EntityMeta[]>} A promise that resolves to an array of EntityMeta objects
   */
  @Get('meta')
  getMeta(): Promise<EntityMeta[]> {
    return this.dynamicEntityService.getMeta()
  }

  /**
   * Endpoint to get all instances of a specific entity
   * @param {string} entity - The slug of the entity to fetch
   * @param {{ [key: string]: string | string[] }} queryParams - The query parameters for the request
   * @returns {Promise<Paginator<any>>} A promise that resolves to a paginator of the entity instances
   */
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

  /**
   * Endpoint to get select options for a specific entity
   * @param {string} entity - The slug of the entity to fetch select options for
   * @returns {Promise<SelectOption[]>} A promise that resolves to an array of SelectOption objects
   */
  @Get(':entity/select-options')
  findSelectOptions(@Param('entity') entity: string): Promise<SelectOption[]> {
    return this.dynamicEntityService.findSelectOptions(entity)
  }

  /**
   * Endpoint to get a specific instance of an entity by its ID
   * @param {string} entity - The slug of the entity to fetch an instance of
   * @param {number} id - The ID of the instance to fetch
   * @returns {Promise<any>} A promise that resolves to the instance of the entity
   */
  @Get(':entity/:id')
  findOne(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<any> {
    return this.dynamicEntityService.findOne(entity, id)
  }

  /**
   * Endpoint to create a new instance of an entity
   * @param {string} entity - The slug of the entity to create an instance of
   * @param {any} entityDto - The data transfer object containing the data for the new instance
   * @returns {Promise<any>} A promise that resolves to the created instance of the entity
   */
  @Post(':entity')
  store(@Param('entity') entity: string, @Body() entityDto: any): Promise<any> {
    return this.dynamicEntityService.store(entity, entityDto)
  }

  /**
   * Endpoint to update an existing instance of an entity by its ID
   * @param {string} entity - The slug of the entity whose instance is to be updated
   * @param {number} id - The ID of the instance to update
   * @param {any} entityDto - The data transfer object containing the new data for the instance
   * @returns {Promise<any>} A promise that resolves to the updated instance of the entity
   */
  @Put(':entity/:id')
  update(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() entityDto: any
  ): Promise<any> {
    return this.dynamicEntityService.update(entity, id, entityDto)
  }

  /**
   * Endpoint to delete an existing instance of an entity by its ID
   * @param {string} entity - The slug of the entity whose instance is to be deleted
   * @param {number} id - The ID of the instance to delete
   * @returns {Promise<any>} A promise that resolves when the deletion is complete
   */
  @Delete(':entity/:id')
  delete(
    @Param('entity') entity: string,
    @Param('id', ParseIntPipe) id: number
  ): Promise<any> {
    return this.dynamicEntityService.delete(entity, id)
  }
}
