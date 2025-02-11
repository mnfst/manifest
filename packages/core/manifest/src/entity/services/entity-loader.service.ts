import { EntityManifest, PropType, PropertyManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import {
  ColumnType,
  EntitySchema,
  EntitySchemaColumnOptions,
  ValueTransformer
} from 'typeorm'
import { baseEntity } from '../core-entities/base-entity'
import { sqlitePropTypeColumnTypes } from '../records/sqlite-prop-type-column-types'
import { baseAuthenticableEntity } from '../core-entities/base-authenticable-entity'
import { RelationshipService } from './relationship.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { postgresPropTypeColumnTypes } from '../records/postgres-prop-type-column-types copy'

@Injectable()
export class EntityLoaderService {
  constructor(
    private entityManifestService: EntityManifestService,
    private relationshipService: RelationshipService
  ) {}

  /**
   * Get entities from Manifest services file and convert into TypeORM entities.
   * @param isPostgres boolean if the database is postgres. Default is false so it is sqlite.
   *
   * @returns EntitySchema[] the entities
   *
   **/
  loadEntities(isPostgres: boolean): EntitySchema[] {
    const entityManifests: EntityManifest[] =
      this.entityManifestService.getEntityManifests({ fullVersion: true })

    // Column types for Postgres and SQLite.
    const columns: Record<PropType, ColumnType> = isPostgres
      ? postgresPropTypeColumnTypes
      : sqlitePropTypeColumnTypes

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
              // Set transformer for number properties (Postgres stores numbers as strings).
              let transformer: ValueTransformer | undefined = undefined
              if (
                propManifest.type === PropType.Number ||
                propManifest.type === PropType.Money
              ) {
                transformer = {
                  from: (value: string | number) => Number(value),
                  to: (value: string | number) => value
                }
              }

              acc[propManifest.name] = {
                name: propManifest.name,
                type: columns[propManifest.type],
                transformer,
                nullable: true // Everything is nullable on the database (validation is done on the application layer).
              }

              return acc
            },
            // Merge with base entities for base columns.
            entityManifest.authenticable
              ? { ...baseAuthenticableEntity }
              : { ...baseEntity }
          ) as { [key: string]: EntitySchemaColumnOptions },
          relations:
            this.relationshipService.getEntitySchemaRelationOptions(
              entityManifest
            ),
          uniques: entityManifest.authenticable ? [{ columns: ['email'] }] : []
        })

        return entitySchema
      }
    )

    return entitySchemas
  }
}
