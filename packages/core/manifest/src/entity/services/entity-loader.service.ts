import { EntityManifest, PropertyManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm'
import { ManifestService } from '../../manifest/services/manifest.service'
import { baseEntity } from '../core-entities/base-entity'
import { propTypeColumnTypes } from '../records/prop-type-column-types'
import { baseAuthenticableEntity } from '../core-entities/base-authenticable-entity'
import { RelationshipService } from './relationship.service'

@Injectable()
export class EntityLoaderService {
  constructor(
    private manifestService: ManifestService,
    private relationshipService: RelationshipService
  ) {}

  /**
   * Load entities from YML file and convert into TypeORM entities.
   *
   * @returns EntitySchema[] the entities
   *
   **/
  loadEntities(): EntitySchema[] {
    const entityManifests: EntityManifest[] =
      this.manifestService.getEntityManifests()

    // Convert Manifest Entities to TypeORM Entities.
    const entitySchemas: EntitySchema[] = entityManifests.map(
      (entityManifest: EntityManifest) => {
        const entitySchema: EntitySchema = new EntitySchema({
          name: entityManifest.className,

          // Convert properties to columns.
          columns: entityManifest.properties.reduce(
            (
              acc: { [key: string]: EntitySchemaColumnOptions },
              propManifest: PropertyManifest
            ) => {
              acc[propManifest.name] = {
                name: propManifest.name,
                type: propTypeColumnTypes[propManifest.type],
                nullable: true // Everything is nullable yet.
              }

              return acc
            },
            // Merge with base entities for base columns.
            entityManifest.authenticable
              ? { ...baseAuthenticableEntity }
              : { ...baseEntity }
          ) as { [key: string]: EntitySchemaColumnOptions },

          // Convert belongsTo relationships to many-to-one relations.
          relations: {
            ...this.relationshipService.getEntitySchemaBelongsToRelationOptions(
              entityManifest.belongsTo
            ),
            ...this.relationshipService.getEntitySchemaHasManyRelationOptions(
              entityManifest.hasMany,
              entityManifest.nameSingular
            )
          },
          uniques: entityManifest.authenticable ? [{ columns: ['email'] }] : []
        })

        return entitySchema
      }
    )

    return entitySchemas
  }
}
