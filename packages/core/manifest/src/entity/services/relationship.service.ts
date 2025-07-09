import { BaseEntity, EntityManifest, RelationshipManifest } from '@repo/types'
import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { EntitySchemaRelationOptions, In, Repository } from 'typeorm'
import { EntityService } from './entity.service'

import { getDtoPropertyNameFromRelationship, camelize } from '@repo/common'
import pluralize from 'pluralize'

@Injectable()
export class RelationshipService {
  constructor(
    @Inject(forwardRef(() => EntityService))
    private entityService: EntityService
  ) {}

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
            name: `${camelize(entityManifest.className)}_${pluralize.singular(manyToManyRelationShip.name)}`
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
        const relationshipName: string = oneToManyRelationship.name

        relationOptions[relationshipName] = {
          target: oneToManyRelationship.entity,
          type: 'one-to-many',
          eager: false,
          inverseSide: oneToManyRelationship.inverseSide,
          cascade: oneToManyRelationship.nested // If the relationship is nested, we want to cascade the operations.
        }
      })

    return relationOptions
  }

  /**
   * Fetches the related items for a given DTO based on the relationships and the DTO's properties. Ex: { tagIds: [1, 2, 3] } -> { tags: [Tag1, Tag2, Tag3] }. This is useful when creating or updating an entity.
   *
   * @param itemDto The DTO to fetch the related items for.
   * @param relationships The relationships to fetch the related items for.
   * @param emptyMissing If true, missing relationships will be emptied from the DTO by returning null or an empty array.
   *
   * @returns A "relationItems" object with the related items.
   * */
  async fetchRelationItemsFromDto({
    itemDto,
    relationships,
    emptyMissing
  }: {
    itemDto: object
    relationships: RelationshipManifest[]
    emptyMissing?: boolean
  }): Promise<{ [key: string]: BaseEntity | BaseEntity[] }> {
    const fetchPromises: { [key: string]: Promise<BaseEntity | BaseEntity[]> } =
      {}

    relationships.forEach(async (relationship: RelationshipManifest) => {
      const propertyName: string =
        getDtoPropertyNameFromRelationship(relationship)

      const relationIds: string[] =
        typeof itemDto[propertyName] === 'string'
          ? [itemDto[propertyName]]
          : itemDto[propertyName] || []

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
        if (emptyMissing) {
          fetchPromises[relationship.name] =
            relationship.type === 'many-to-one'
              ? Promise.resolve(null)
              : Promise.resolve([])
        }
      }
    })

    const relationItems: { [key: string]: BaseEntity | BaseEntity[] } = {}

    for (const [key, fetchPromise] of Object.entries(fetchPromises)) {
      relationItems[key] = await fetchPromise
    }

    return relationItems
  }
}
