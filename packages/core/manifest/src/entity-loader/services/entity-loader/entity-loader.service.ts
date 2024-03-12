import { Injectable } from '@nestjs/common'
import {
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
import { propTypeCharacteristicsRecord } from '../../records/prop-type-characteristics.record'

@Injectable()
export class EntityLoaderService {
  constructor(private manifestService: ManifestService) {}

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
}
