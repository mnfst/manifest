import { faker } from '@faker-js/faker'
import { EntityManifest, RelationshipManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import { EntitySchemaRelationOptions } from 'typeorm'
import { DEFAULT_MAX_MANY_TO_MANY_RELATIONS } from '../../constants'
import { HelperService } from '../../crud/services/helper.service'

@Injectable()
export class RelationshipService {
  constructor(private manifestService: ManifestService) {}

  /**
   * Get the seed value for a relationship based on the number of relation items (seed count).
   *
   * @param relationshipManifest The relationship manifest in its detailed form.
   *
   * @returns An single id or an array of objects with an id property.
   *
   **/
  getSeedValue(
    relationshipManifest: RelationshipManifest
  ): number | { id: number }[] {
    const relatedEntity: EntityManifest =
      this.manifestService.getEntityManifest({
        className: relationshipManifest.entity
      })

    if (relationshipManifest.type === 'many-to-one') {
      return faker.number.int({
        min: 1,
        max: relatedEntity.seedCount
      })
    } else if (relationshipManifest.type === 'many-to-many') {
      // On many-to-many relationships, we need to generate a random number of relations.

      const max: number =
        DEFAULT_MAX_MANY_TO_MANY_RELATIONS > relatedEntity.seedCount
          ? relatedEntity.seedCount
          : DEFAULT_MAX_MANY_TO_MANY_RELATIONS

      const numberOfRelations: number = faker.number.int({
        min: 0,
        max
      })

      const relations: { id: number }[] = []

      for (let i = 0; i < numberOfRelations; i++) {
        relations.push({
          // We need to make sure that the id is unique.
          id: HelperService.getRandomIntExcluding(
            1,
            relatedEntity.seedCount,
            relations.map((relation) => relation.id)
          )
        })
      }

      return relations
    }
  }

  getEntitySchemaRelationOptions(
    relationships: RelationshipManifest[],
    centralEntityName: string
  ): { [key: string]: EntitySchemaRelationOptions } {
    const belongsToRelationships: RelationshipManifest[] = relationships.filter(
      (relationship: RelationshipManifest) =>
        relationship.type === 'many-to-one'
    )

    const hasManyRelationships: RelationshipManifest[] = relationships.filter(
      (relationship: RelationshipManifest) =>
        relationship.type === 'many-to-many'
    )

    return {
      ...this.getEntitySchemaBelongsToRelationOptions(belongsToRelationships),
      ...this.getEntitySchemaHasManyRelationOptions(
        hasManyRelationships,
        centralEntityName
      )
    }
  }

  /**
   * Converts belongsTo relationships to TypeORM EntitySchemaRelationOptions of many-to-one relations.
   *
   * @param belongsToRelationships The belongsTo relationships to convert.
   *
   * @returns The converted EntitySchemaRelationOptions.
   *
   */
  getEntitySchemaBelongsToRelationOptions(
    belongsToRelationships: RelationshipManifest[]
  ): { [key: string]: EntitySchemaRelationOptions } {
    return belongsToRelationships.reduce(
      (
        acc: { [key: string]: EntitySchemaRelationOptions },
        belongsToRelationShip: RelationshipManifest
      ) => {
        acc[belongsToRelationShip.name] = {
          target: belongsToRelationShip.entity,
          type: 'many-to-one',
          eager: !!belongsToRelationShip.eager
        }

        return acc
      },
      {}
    )
  }

  /**
   * Converts hasMany relationships to TypeORM EntitySchemaRelationOptions of one-to-many relations.
   * @param hasManyRelationships  The hasMany relationships to convert.
   * @param centralEntityName The name of the entity that has the hasMany relationships.
   *
   * @returns The converted EntitySchemaRelationOptions.
   */
  getEntitySchemaHasManyRelationOptions(
    hasManyRelationships: RelationshipManifest[],
    centralEntityName: string
  ): { [key: string]: EntitySchemaRelationOptions } {
    return hasManyRelationships.reduce(
      (
        acc: { [key: string]: EntitySchemaRelationOptions },
        hasManyRelationShip: RelationshipManifest
      ) => {
        acc[hasManyRelationShip.name] = {
          target: hasManyRelationShip.entity,
          type: 'many-to-many',
          eager: !!hasManyRelationShip.eager,
          cascade: true,
          joinTable: {
            name: `${centralEntityName}_${hasManyRelationShip.name}`
          }
        }
        return acc
      },
      {}
    )
  }
}
