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
import { RelationOptions } from '../../../../shared/interfaces/property-options/relation-options.interface'

@Injectable()
export class EntityMetaService {
  constructor(private dataSource: DataSource) {}

  /**
   * Returns the full list of entities.
   *
   * @returns the full list of entities
   */
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

  /**
 * Returns the TypeORM repository of an entity.
 *

 * @param entitySlug - The slug of the entity
 * @returns the TypeORM repository of an entity
 *
 * @beta
 */
  getRepository(entitySlug: string): Repository<any> {
    return this.dataSource.getRepository(
      this.getEntityMetadata(entitySlug).target
    )
  }

  getEntityMetadata(entitySlug): EntityMetadata {
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
        entityMetadata.columns[1].propertyName // The 2nd column is usually the name.
    }
  }

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
