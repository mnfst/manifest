import { Injectable } from '@nestjs/common'
import {
  EntitySchema,
  EntitySchemaColumnOptions,
  EntitySchemaRelationOptions
} from 'typeorm'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'
import {
  EntityManifest,
  PropertyManifest
} from '../../../manifest/typescript/manifest-types'
import { DetailedRelationshipManifest } from '../../../manifest/typescript/other/detailed-relationship-manifest.type'
import { baseEntity } from '../../core-entities/base-entity'
import { propTypeColumnTypes } from '../../records/prop-type-column-types'

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
    const entityManifests: EntityManifest[] =
      this.manifestService.getEntityManifests()

    const entitySchemas: EntitySchema[] = entityManifests.map(
      (entityManifest: EntityManifest) => {
        const entitySchema: EntitySchema = new EntitySchema({
          name: entityManifest.className,

          // Convert properties to columns.
          columns: Object.entries(entityManifest.properties).reduce(
            (
              acc: { [key: string]: EntitySchemaColumnOptions },
              [propName, propManifest]: [string, PropertyManifest]
            ) => {
              acc[propName] = {
                name: propName,
                type: propTypeColumnTypes[propManifest.type]
              }

              return acc
            },
            // Merge with baseEntity for base columns like id, createdAt, updatedAt.
            { ...baseEntity }
          ),

          // Convert belongsTo relationships to many-to-one relations.
          relations: Object.entries(entityManifest.belongsTo || []).reduce(
            (
              acc: { [key: string]: EntitySchemaRelationOptions },
              [belongsToName, belongsToRelationShip]: [
                string,
                DetailedRelationshipManifest
              ]
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
