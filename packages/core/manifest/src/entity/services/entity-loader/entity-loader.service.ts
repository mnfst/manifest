import { Injectable, NotFoundException } from '@nestjs/common'
import {
  DataSource,
  EntityMetadata,
  EntitySchema,
  EntitySchemaColumnOptions,
  EntitySchemaRelationOptions
} from 'typeorm'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'
import {
  Entity,
  Property,
  Relationship
} from '../../../manifest/typescript/manifest-types'
import { baseEntity } from '../../entities/base-entity'
import { propTypeCharacteristicsRecord } from '../../records/prop-type-column-definition.record'

@Injectable()
export class EntityService {
  constructor(
    private manifestService: ManifestService,
    private dataSource: DataSource
  ) {}

  /**
   * Load entities from YML file and convert into TypeORM entities.
   *
   * @returns EntitySchema[] the entities
   *
   **/
  loadEntities(): EntitySchema[] {
    const manifestEntities: {
      [key: string]: Entity
    } = this.manifestService.loadEntities()

    const entitySchemas: EntitySchema[] = Object.entries(manifestEntities).map(
      ([name, entity]: [string, Entity]) => {
        const entitySchema: EntitySchema = new EntitySchema({
          name,

          // Convert properties to columns.
          columns: Object.entries(entity.properties).reduce(
            (
              acc: { [key: string]: EntitySchemaColumnOptions },
              [propName, propDescription]: [string, Property]
            ) => {
              acc[propName] = {
                name: propName,
                type: propTypeCharacteristicsRecord[propDescription.type]
                  .columnType
              }

              return acc
            },
            // Merge with baseEntity for base columns like id, createdAt, updatedAt.
            { ...baseEntity }
          ),

          // Convert belongsTo relationships to many-to-one relations.
          relations: Object.entries(entity.belongsTo || []).reduce(
            (
              acc: { [key: string]: EntitySchemaRelationOptions },
              [belongsToName, belongsToRelationShip]: [string, Relationship]
            ) => {
              acc[belongsToName] = {
                target: belongsToRelationShip.entity,
                type: 'many-to-one',
                eager: !!belongsToRelationShip.eager
              }

              return acc
            },
            {}
          )
        })

        return entitySchema
      }
    )

    return entitySchemas
  }

  /**
   * Returns the TypeORM EntityMetadata from an entity class name.
   *
   * @param entityName - The class name of the entity
   * @returns the TypeORM entity metadata
   */
  getEntityMetadata(entityName: string): EntityMetadata {
    const entityMetadata: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entityMetadata: EntityMetadata) =>
        entityMetadata.target['name'] === entityName
    )

    if (!entityMetadata) {
      throw new NotFoundException('Entity not found')
    }
    return entityMetadata
  }
}
