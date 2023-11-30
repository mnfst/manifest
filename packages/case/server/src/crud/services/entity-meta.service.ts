import { Injectable, NotFoundException } from '@nestjs/common'
import * as dasherize from 'dasherize'
import * as pluralize from 'pluralize'
import { DataSource, DeepPartial, EntityMetadata, Repository } from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'
import { PropType } from '../../../../shared/enums/prop-type.enum'
import { EntityDefinition } from '../../../../shared/interfaces/entity-definition.interface'
import { EntityMeta } from '../../../../shared/interfaces/entity-meta.interface'
import { PropertyDescription } from '../../../../shared/interfaces/property-description.interface'
import { RelationPropertyOptions } from '../../../../shared/interfaces/property-options/relation-property-options.interface'
import { Policies } from '../../api/policies'
import { AuthenticableEntity } from '../../core-entities/authenticable-entity'

@Injectable()
export class EntityMetaService {
  constructor(private dataSource: DataSource) {}

  /**
   * Returns the full list of entities with their definition and properties.
   *
   * @returns the full list of entities
   */
  getMeta(): EntityMeta[] {
    return this.dataSource.entityMetadatas.map(
      (entityMetadata: EntityMetadata) => ({
        className: entityMetadata.name,
        definition: this.getEntityDefinition(entityMetadata),
        props: this.getPropDescriptions(entityMetadata)
      })
    )
  }

  /**
   * Returns an array of all entities that extend AuthenticableEntity, in other words, all entities that can be used for authentication.
   *
   * @returns An array of all entity metadata that extend AuthenticableEntity.
   */
  getAuthenticableEntities(): EntityMetadata[] {
    return this.dataSource.entityMetadatas.filter(
      (entity: EntityMetadata) =>
        (entity.target as Function).prototype instanceof AuthenticableEntity
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
          const relationOptions: RelationPropertyOptions =
            propDescription.options as RelationPropertyOptions

          // Convert class to string to use in the client.
          relationOptions.entitySlug = relationOptions.entity?.name
        }

        return propDescription
      })
  }

  /**
   * Returns the TypeORM repository of an entity from its slug.
   *
   * @param entitySlugOrClassName - The slug or class name of the entity
   * @returns the TypeORM repository of an entity
   */
  getRepository(entitySlugOrClassName: string): Repository<any> {
    return this.dataSource.getRepository(
      this.getEntityMetadata(entitySlugOrClassName).target
    )
  }

  /**
   * Returns the TypeORM repository of an entity from its table name.
   *
   * @param entitySlug - The DB table name of the entity
   * @returns the TypeORM repository of an entity
   */
  getRepositoryFromTableName(entityTableName: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) => entity.tableName === entityTableName
    )

    if (!entity) {
      throw new Error('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }

  /**
   * Returns the TypeORM entity metadata from an entity slug or class name.
   *
   * @param entitySlugOrClassName - The slug or class name of the entity
   * @returns the TypeORM entity metadata
   */
  getEntityMetadata(entitySlugOrClassName: string): EntityMetadata {
    const entityMetadata: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entityMetadata: EntityMetadata) =>
        this.getEntityDefinition(entityMetadata).slug ===
          entitySlugOrClassName ||
        entityMetadata.target['name'] === entitySlugOrClassName
    )

    if (!entityMetadata) {
      throw new NotFoundException('Entity not found')
    }
    return entityMetadata
  }

  /**
   * Returns the full definition of an entity.
   *
   * @param entity - The entity metadata or slug
   * @returns the definition of an entity
   */
  getEntityDefinition(entity: EntityMetadata | string): EntityDefinition {
    if (typeof entity === 'string') {
      entity = this.getEntityMetadata(entity)
    }
    const entityMetadata: EntityMetadata = entity as EntityMetadata

    const partialDefinition: Partial<EntityDefinition> = (
      entityMetadata.inheritanceTree[0] as any
    ).definition

    const defaultSeedCount: number = 50

    return {
      nameSingular:
        partialDefinition?.nameSingular ||
        pluralize.singular(entityMetadata.name).toLowerCase(),
      namePlural:
        partialDefinition?.namePlural ||
        pluralize.plural(entityMetadata.name).toLowerCase(),
      slug:
        partialDefinition?.slug ||
        dasherize(pluralize.plural(entityMetadata.name)).toLowerCase(),
      propIdentifier:
        partialDefinition?.propIdentifier ||
        entityMetadata.columns[1].propertyName, // The 2nd column is usually the name.
      seedCount: partialDefinition?.seedCount || defaultSeedCount,
      apiPolicies: {
        create:
          partialDefinition?.apiPolicies?.create || Policies.noRestriction,
        read: partialDefinition?.apiPolicies?.read || Policies.noRestriction,
        update:
          partialDefinition?.apiPolicies?.update || Policies.noRestriction,
        delete: partialDefinition?.apiPolicies?.delete || Policies.noRestriction
      }
    }
  }

  /**
   * Loads the relations of an entity.
   *
   * @param entity - The entity
   * @param relationMetadatas - The relations to load
   * @returns an object with the relation items
   */
  async loadRelations(
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
