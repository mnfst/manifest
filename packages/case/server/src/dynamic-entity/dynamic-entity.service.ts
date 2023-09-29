import { Injectable, NotFoundException } from '@nestjs/common'
import {
  DataSource,
  EntityMetadata,
  FindManyOptions,
  FindOptionsWhere,
  In,
  Repository
} from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'

import { PropType } from '../../../shared/enums/prop-type.enum'
import { EntityMeta } from '../../../shared/interfaces/entity-meta.interface'
import { Paginator } from '../../../shared/interfaces/paginator.interface'
import { PropertyDescription } from '../../../shared/interfaces/property-description.interface'
import { RelationOptions } from '../../../shared/interfaces/property-options/relation-options.interface'
import { SelectOption } from '../../../shared/interfaces/select-option.interface'

/**
 * Service for handling dynamic entities
 * @class DynamicEntityService 
 * @property {DataSource} dataSource - The TypeORM data source
 * 
 */
@Injectable()
export class DynamicEntityService {
  constructor(private dataSource: DataSource) { }
  /**
   * Finds all instances of a specific entity
   * @async
   * @param {Object} params - The parameters for the request
   * @param {string} params.entitySlug - The slug of the entity to fetch
   * @param {Object} [params.queryParams] - The query parameters for the request
   * @param {Object} [params.options] - Additional options for the request
   * @param {boolean} [params.options.paginated] - Whether to paginate the results
   * @returns {Promise<Paginator<any> | any[]>} A promise that resolves to a paginator of the entity instances or an array of instances if not paginated
   */
  async findAll({
    entitySlug,
    queryParams,
    options
  }: {
    entitySlug: string
    queryParams?: { [key: string]: string | string[] }
    options?: { paginated?: boolean }
  }): Promise<Paginator<any> | any[]> {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    // Get entity relations
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    const relations: string[] = entity.relations.map(
      (relation: RelationMetadata) => relation.propertyName
    )

    // Dynamic filtering.
    const where: FindOptionsWhere<any> = {}

    Object.keys(queryParams || {}).forEach((key: string) => {
      // Check if key is a relation.
      if (relations.includes(key)) {
        // Force array.
        if (typeof queryParams[key] === 'string') {
          queryParams[key] = [queryParams[key] as string]
        }
        // Add relation where clause: { relation: In([1, 2, 3])  }
        where[key] = In(queryParams[key] as string[])
      }
    })

    const findManyOptions: FindManyOptions<any> = {
      order: { id: 'DESC' },
      relations,
      where
    }

    // Non paginated results.
    if (!options?.paginated) {
      return await entityRepository.find(findManyOptions)
    }

    // Paginated results.
    const currentPage: number = parseInt(queryParams.page as string, 10) || 1

    findManyOptions.take = 10
    findManyOptions.skip = (currentPage - 1) * findManyOptions.take

    const total: number = await entityRepository.count(findManyOptions)
    const results: any[] = await entityRepository.find(findManyOptions)

    const paginator: Paginator<any> = {
      data: results,
      currentPage,
      lastPage: Math.ceil(total / findManyOptions.take),
      from: findManyOptions.skip + 1,
      to: findManyOptions.skip + findManyOptions.take,
      total,
      perPage: findManyOptions.take
    }

    return paginator
  }

  /**
 * Finds select options for a specific entity
 * @async
 * @param {string} entitySlug - The slug of the entity to fetch select options for
 * @returns {Promise<SelectOption[]>} A promise that resolves to an array of SelectOption objects
 */
  async findSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    const items: any[] = (await this.findAll({
      entitySlug
    })) as any[]

    // Get entity propIdentifier.
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    return items.map((item: any) => ({
      id: item.id,
      label: item[(entity.target as any).definition.propIdentifier]
    }))
  }
  /**
   * Finds a specific instance of an entity by its ID
   * @async
   * @param {string} entitySlug - The slug of the entity to fetch an instance of
   * @param {number} id - The ID of the instance to fetch
   * @returns {Promise<any>} A promise that resolves to the instance of the entity
   */
  async findOne(entitySlug: string, id: number) {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    const item = await this.getRepository(entitySlug).findOne({
      where: { id },
      relations: entity.relations.map(
        (relation: RelationMetadata) => relation.propertyName
      )
    })

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  /**
 * Stores a new instance of an entity and returns it
 * @async
 * @param {string} entitySlug - The slug of the entity to create an instance of
 * @param {any} entityDto - The data transfer object containing the data for the new instance
 * @returns {Promise<any>} A promise that resolves to the created instance of the entity
 */
  async store(entitySlug: string, entityDto: any) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    return entityRepository.insert(entityRepository.create(entityDto))
  }

  /**
 * Updates an existing instance of an entity by its ID
 * @async
 * @param {string} entitySlug - The slug of the entity whose instance is to be updated
 * @param {number} id - The ID of the instance to update
 * @param {any} entityDto - The data transfer object containing the new data for the instance
 * @returns {Promise<any>} A promise that resolves to the updated instance of the entity
 */
  async update(entitySlug: string, id: number, entityDto: any) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    const entityToSave = entityRepository.create({
      ...item,
      ...entityDto
    })

    return entityRepository.save(entityToSave)
  }
  /**
   * Deletes an existing instance of an entity by its ID
   * @async
   * @param {string} entitySlug - The slug of the entity whose instance is to be deleted
   * @param {number} id - The ID of the instance to delete
   * @returns {Promise<any>} A promise that resolves when the deletion is complete
   */
  async delete(entitySlug: string, id: number) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }
  /**
   * Gets metadata for all entities
   * @async
   * @returns {Promise<EntityMeta[]>} A promise that resolves to an array of EntityMeta objects
   */
  async getMeta(): Promise<EntityMeta[]> {
    return this.dataSource.entityMetadatas.map((entity: EntityMetadata) => ({
      className: entity.name,
      definition: (entity.inheritanceTree[0] as any).definition,
      props: this.getPropDescriptions(entity)
    }))
  }

  /**
 * Gets descriptions of the properties of an entity
 * @param {EntityMetadata} entity - The metadata of the entity to get property descriptions for
 * @returns {PropertyDescription[]} An array of property descriptions
 */
  getPropDescriptions(entity: EntityMetadata): PropertyDescription[] {
    // Get metadata from entity (based on decorators). We are basically creating a new entity instance to get the metadata (there is probably a better way to do this).
    const entityRepository: Repository<any> = this.getRepository(
      (entity.inheritanceTree[0] as any).definition.slug
    )
    const newItem = entityRepository.create()

    return entity.columns
      .filter((column: ColumnMetadata) => column.propertyName !== 'id')
      .map((column: ColumnMetadata) => {
        const propDescription: PropertyDescription = {
          propName: column.propertyName,
          label: Reflect.getMetadata(`${column.propertyName}:label`, newItem),
          type: Reflect.getMetadata(`${column.propertyName}:type`, newItem),
          options: Reflect.getMetadata(
            `${column.propertyName}:options`,
            newItem
          )
        }

        if (propDescription.type === PropType.Relation) {
          const relationOptions: RelationOptions =
            propDescription.options as RelationOptions

          // Convert class to string to use in the client.
          relationOptions.entitySlug = relationOptions.entity?.name
        }

        return propDescription
      })
  }
  /**
   * Gets the repository for a specific entity
   * @private
   * @param {string} entitySlug - The slug of the entity to get the repository for
   * @returns {Repository<any>} The repository for the entity
   */

  private getRepository(entitySlug: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    if (!entity) {
      throw new NotFoundException('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }
}
