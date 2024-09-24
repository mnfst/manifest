import { faker } from '@faker-js/faker'
import { BaseEntity, EntityManifest, RelationshipManifest } from '@repo/types'
import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import { EntitySchemaRelationOptions, In, Repository } from 'typeorm'
import { DEFAULT_MAX_MANY_TO_MANY_RELATIONS } from '../../constants'
import { EntityService } from './entity.service'

import {
  getRandomIntExcluding,
  getDtoPropertyNameFromRelationship,
  forceNumberArray,
  camelize
} from '@repo/helpers'
import pluralize from 'pluralize'

@Injectable()
export class RelationshipService {
  constructor(
    private manifestService: ManifestService,
    @Inject(forwardRef(() => EntityService))
    private entityService: EntityService
  ) {}

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
    } else if (
      relationshipManifest.type === 'many-to-many' &&
      relationshipManifest.owningSide
    ) {
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

      while (relations.length < numberOfRelations) {
        const newRelation: { id: number } = {
          // We need to make sure that the id is unique.
          id: getRandomIntExcluding({
            min: 1,
            max: relatedEntity.seedCount,
            exclude: relations.map((relation) => relation.id)
          })
        }

        // Only add the relation if it's not already in the list to prevent duplicates.
        if (!relations.find((relation) => relation.id === newRelation.id)) {
          relations.push(newRelation)
        }
      }

      return relations
    }
  }

  /**
   * Get the TypeORM EntitySchemaRelationOptions for a given entity based on its relationships.
   *
   * @param entityManifest The entity manifest to get the relationships for.
   *
   * @returns The EntitySchemaRelationOptions for the given entity.
   * */
  getEntitySchemaRelationOptions(entityManifest: EntityManifest): {
    [key: string]: EntitySchemaRelationOptions
  } {
    const relationOptions: {
      [key: string]: EntitySchemaRelationOptions
    } = {}

    // Get the many-to-one relationships.
    entityManifest.relationships
      .filter(
        (relationship: RelationshipManifest) =>
          relationship.type === 'many-to-one'
      )
      .forEach((belongsToRelationShip: RelationshipManifest) => {
        relationOptions[belongsToRelationShip.name] = {
          target: belongsToRelationShip.entity,
          type: 'many-to-one',
          eager: !!belongsToRelationShip.eager
        }
      })

    // Get the many-to-many relationships.
    entityManifest.relationships
      .filter(
        (relationship: RelationshipManifest) =>
          relationship.type === 'many-to-many'
      )
      .forEach((manyToManyRelationShip: RelationshipManifest) => {
        relationOptions[manyToManyRelationShip.name] = {
          target: manyToManyRelationShip.entity,
          type: 'many-to-many',
          eager: !!manyToManyRelationShip.eager,
          inverseSide: manyToManyRelationShip.inverseSide
        }

        // If this is the owning side of the relationship, we need to set the join table name.
        if (manyToManyRelationShip.owningSide) {
          relationOptions[manyToManyRelationShip.name].joinTable = {
            name: `${camelize(entityManifest.className)}_${manyToManyRelationShip.name}`
          }
        }
      })

    // Get the one-to-many relationships.
    entityManifest.relationships
      .filter(
        (relationship: RelationshipManifest) =>
          relationship.type === 'one-to-many'
      )
      .forEach((oneToManyRelationship: RelationshipManifest) => {
        const relationshipName: string = pluralize(oneToManyRelationship.name)

        relationOptions[relationshipName] = {
          target: oneToManyRelationship.entity,
          type: 'one-to-many',
          eager: false,
          inverseSide: oneToManyRelationship.inverseSide
        }
      })

    return relationOptions
  }

  /**
   * Fetches the related items for a given DTO based on the relationships and the DTO's properties. Ex: { tagIds: [1, 2, 3] } -> { tags: [Tag1, Tag2, Tag3] }. This is useful when creating or updating an entity.
   *
   * @param itemDto The DTO to fetch the related items for.
   * @param relationships The relationships to fetch the related items for.
   *
   * @returns A "relationItems" object with the related items.
   * */
  async fetchRelationItemsFromDto(
    itemDto: Object,
    relationships: RelationshipManifest[]
  ): Promise<{ [key: string]: BaseEntity | BaseEntity[] }> {
    const fetchPromises: { [key: string]: Promise<BaseEntity | BaseEntity[]> } =
      {}

    relationships.forEach(async (relationship: RelationshipManifest) => {
      const propertyName: string =
        getDtoPropertyNameFromRelationship(relationship)

      const relationIds: number[] = forceNumberArray(itemDto[propertyName])

      if (relationIds.length) {
        const relatedEntityRepository: Repository<BaseEntity> =
          this.entityService.getEntityRepository({
            entityMetadata: this.entityService.getEntityMetadata({
              className: relationship.entity
            })
          })

        fetchPromises[relationship.name] =
          relationship.type === 'many-to-one'
            ? relatedEntityRepository.findOneBy({ id: relationIds[0] })
            : relatedEntityRepository.findBy({
                id: In(relationIds)
              })
      } else {
        fetchPromises[relationship.name] =
          relationship.type === 'many-to-one'
            ? Promise.resolve(null)
            : Promise.resolve([])
      }
    })

    const relationItems: { [key: string]: BaseEntity | BaseEntity[] } = {}

    for (const [key, value] of Object.entries(fetchPromises)) {
      relationItems[key] = await value
    }

    return relationItems
  }
}
