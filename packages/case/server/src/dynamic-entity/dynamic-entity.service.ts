import { Injectable, NotFoundException } from '@nestjs/common'
import * as dasherize from 'dasherize'
import {
  DataSource,
  DeepPartial,
  DeleteResult,
  EntityMetadata,
  FindManyOptions,
  FindOptionsWhere,
  In,
  Repository
} from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'

import * as pluralize from 'pluralize'
import { PropType } from '../../../shared/enums/prop-type.enum'
import { EntityDefinition } from '../../../shared/interfaces/entity-definition.interface'
import { EntityMeta } from '../../../shared/interfaces/entity-meta.interface'
import { Paginator } from '../../../shared/interfaces/paginator.interface'
import { PropertyDescription } from '../../../shared/interfaces/property-description.interface'
import { RelationOptions } from '../../../shared/interfaces/property-options/relation-options.interface'
import { SelectOption } from '../../../shared/interfaces/select-option.interface'

@Injectable()
export class DynamicEntityService {
  constructor(private dataSource: DataSource) {}

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
    const relations: string[] = this.getEntityMetadata(
      entitySlug
    ).relations.map((relation: RelationMetadata) => relation.propertyName)

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

  async findSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    const items: any[] = (await this.findAll({
      entitySlug
    })) as any[]

    return items.map((item: any) => ({
      id: item.id,
      label:
        item[
          (this.getEntityMetadata(entitySlug).target as any).definition
            .propIdentifier
        ]
    }))
  }

  async findOne(entitySlug: string, id: number) {
    const item = await this.getRepository(entitySlug).findOne({
      where: { id },
      relations: this.getEntityMetadata(entitySlug).relations.map(
        (relation: RelationMetadata) => relation.propertyName
      )
    })

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(entitySlug: string, entityDto: any) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const newEntity = entityRepository.create(entityDto)

    const relations: RelationMetadata[] =
      this.getEntityMetadata(entitySlug).relations

    // If we have relations, we load them to be available in the @BeforeInsert() hook.
    if (relations.length) {
      newEntity._relations = await this.loadRelations(newEntity, relations)
    }

    return entityRepository.insert(newEntity)
  }

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

  async delete(entitySlug: string, id: number): Promise<DeleteResult> {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }

  async getMeta(): Promise<EntityMeta[]> {
    return this.dataSource.entityMetadatas.map(
      (entityMetadata: EntityMetadata) => ({
        className: entityMetadata.name,
        definition: this.getEntityDefinition(entityMetadata),
        props: this.getPropDescriptions(entityMetadata)
      })
    )
  }

  getPropDescriptions(entityMetadata: EntityMetadata): PropertyDescription[] {
    // Get metadata from entity (based on decorators). We are basically creating a new entity instance to get the metadata (there is probably a better way to do this).
    const entityRepository: Repository<any> = this.getRepository(
      this.getEntityDefinition(entityMetadata).slug
    )
    const newItem = entityRepository.create()

    return entityMetadata.columns
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

  private getRepository(entitySlug: string): Repository<any> {
    return this.dataSource.getRepository(
      this.getEntityMetadata(entitySlug).target
    )
  }

  private getEntityMetadata(entitySlug): EntityMetadata {
    const entityMetadata: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        this.getEntityDefinition(entity).slug === entitySlug
    )

    if (!entityMetadata) {
      throw new NotFoundException('Entity not found')
    }

    return entityMetadata
  }

  getEntityDefinition(entityMetadata: EntityMetadata): EntityDefinition {
    const partialDefinition: Partial<EntityDefinition> = (
      entityMetadata.inheritanceTree[0] as any
    ).definition

    return {
      nameSingular:
        partialDefinition.nameSingular ||
        pluralize.singular(entityMetadata.name).toLowerCase(),
      namePlural:
        partialDefinition.namePlural ||
        pluralize.plural(entityMetadata.name).toLowerCase(),
      slug:
        partialDefinition.slug ||
        dasherize(pluralize.plural(entityMetadata.name)).toLowerCase(),
      propIdentifier:
        partialDefinition.propIdentifier ||
        entityMetadata.columns[1].propertyName // The 2nd column is usually the name.
    }
  }

  private async loadRelations(
    entity: DeepPartial<any>,
    relationMetadatas: RelationMetadata[]
  ): Promise<any> {
    const relations = {}

    await Promise.all(
      relationMetadatas.map(async (relation: RelationMetadata) => {
        const relationRepository: Repository<any> = this.getRepository(
          this.getEntityDefinition(relation.inverseEntityMetadata).slug
        )

        // Create a property with the relation name and assign the related object to it.
        relations[relation.propertyName] = await relationRepository.findOne({
          where: { id: entity[relation.propertyName] }
        })
      })
    )

    return relations
  }
}
