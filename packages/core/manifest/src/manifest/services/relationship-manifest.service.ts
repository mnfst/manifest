import { Injectable } from '@nestjs/common'
import {
  EntityManifest,
  PropertyManifest,
  PropType,
  RelationshipManifest,
  RelationshipSchema
} from '../../../../types/src'
import { camelize } from '@repo/common'
import pluralize from 'pluralize'

@Injectable()
export class RelationshipManifestService {
  /**
   *
   * Transform the short form of the relationship into the long form.
   *
   * @param relationship the relationship that can include short form properties.
   * @param type the type of the relationship.
   * @param entityClassName the class name of the entity to which the relationship belongs (only for many-to-many relationships).
   *
   * @returns the relationship with the short form properties transformed into long form.
   */
  transformRelationship(
    relationship: RelationshipSchema,
    type: 'many-to-one' | 'many-to-many',
    entityClassName?: string
  ): RelationshipManifest {
    const relationshipName: string =
      RelationshipManifestService.generateRelationshipName(relationship, type)

    const relationshipEntity: string =
      RelationshipManifestService.generateRelationshipEntity(relationship)

    if (type === 'many-to-one') {
      if (typeof relationship === 'string') {
        return {
          name: relationshipName,
          entity: relationshipEntity,
          eager: false,
          type
        }
      }
      return {
        name: relationshipName,
        entity: relationshipEntity,
        eager: relationship.eager || false,
        helpText: relationship.helpText || '',
        type
      }
    } else {
      // Many-to-many.
      if (typeof relationship === 'string') {
        return {
          name: relationshipName,
          entity: relationshipEntity,
          eager: false,
          type,
          owningSide: true,
          inverseSide: pluralize(camelize(entityClassName))
        }
      }

      return {
        name: relationshipName,
        entity: relationshipEntity,
        eager: relationship.eager || false,
        helpText: relationship.helpText || '',
        type,
        owningSide: true,
        inverseSide: pluralize(camelize(entityClassName))
      }
    }
  }

  /**
   * Generate the ManyToOne and OneToOne relationships from the nested properties of the entity schema.
   *
   * @param nestedEntitySchema The entity schema that contains the nested properties.
   * @param allEntitySchemas The list of all entity schemas to search for nested properties.
   *
   * @returns The relationships generated from the nested properties.
   */
  getRelationshipManifestsFromNestedProperties(
    nestedEntityManifest: EntityManifest,
    allEntityManifests: EntityManifest[]
  ): RelationshipManifest[] {
    return allEntityManifests.reduce(
      (acc: RelationshipManifest[], entityManifest: EntityManifest) => {
        entityManifest.properties
          .filter(
            (property: PropertyManifest) =>
              property.type === PropType.Nested &&
              property.options?.group === nestedEntityManifest.className
          )
          .forEach((property: PropertyManifest) => {
            acc.push({
              name: camelize(entityManifest.nameSingular),
              inverseSide: property.name,
              entity: entityManifest.className,
              owningSide: true,
              type:
                property.options?.multiple === false
                  ? 'one-to-one'
                  : 'many-to-one',
              eager: false,
              helpText: property.helpText || ''
            })
          })

        return acc
      },
      []
    )
  }

  /**
   * Generate the OneToMany relationships from the opposite ManyToOne relationships.
   *
   * @param entityManifests The entity manifests.
   * @param currentEntityManifest The entity manifest for which to generate the OneToMany relationships.
   *
   * @returns The OneToMany relationships.
   */
  getOppositeOneToManyRelationships(
    entityManifests: EntityManifest[],
    currentEntityManifest: EntityManifest
  ): RelationshipManifest[] {
    // We need to get the entities that have ManyToOne relationships to the current entity to create the opposite OneToMany relationships.
    const oppositeRelationships: {
      entity: EntityManifest
      relationship: RelationshipManifest
    }[] = entityManifests
      .filter(
        (otherEntityManifest: EntityManifest) =>
          otherEntityManifest.className !== currentEntityManifest.className
      )
      .reduce((acc, otherEntityManifest: EntityManifest) => {
        const oppositeRelationship: RelationshipManifest =
          otherEntityManifest.relationships.find(
            (relationship: RelationshipManifest) =>
              relationship.entity === currentEntityManifest.className &&
              relationship.type === 'many-to-one'
          )

        if (oppositeRelationship) {
          acc.push({
            entity: otherEntityManifest,
            relationship: oppositeRelationship
          })
        }

        return acc
      }, [])

    return oppositeRelationships.map(
      (oppositeRelationship: {
        entity: EntityManifest
        relationship: RelationshipManifest
      }) => {
        const relationship: RelationshipManifest = {
          name: camelize(oppositeRelationship.entity.namePlural),
          entity: oppositeRelationship.entity.className,
          eager: !!oppositeRelationship.entity.nested,
          nested: !!oppositeRelationship.entity.nested,
          type: 'one-to-many',
          inverseSide: oppositeRelationship.relationship.name,
          helpText: oppositeRelationship.relationship.helpText || ''
        }

        return relationship
      }
    )
  }

  /**
   * Generate the ManyToMany relationships from the opposite ManyToMany relationships.
   *
   * @param entityManifests The entity manifests.
   * @param currentEntityManifest The entity manifest for which to generate the ManyToMany relationships.
   *
   * @returns The ManyToMany relationships.
   */
  getOppositeManyToManyRelationships(
    entityManifests: EntityManifest[],
    currentEntityManifest: EntityManifest
  ): RelationshipManifest[] {
    // We need to get the entities that have ManyToMany relationships to the current entity to create the opposite ManyToMany relationships.
    const oppositeRelationships: {
      entity: EntityManifest
      relationship: RelationshipManifest
    }[] = entityManifests
      .filter(
        (otherEntityManifest: EntityManifest) =>
          otherEntityManifest.className !== currentEntityManifest.className
      )
      .reduce((acc, otherEntityManifest: EntityManifest) => {
        const oppositeRelationship: RelationshipManifest =
          otherEntityManifest.relationships.find(
            (relationship: RelationshipManifest) =>
              relationship.entity === currentEntityManifest.className &&
              relationship.type === 'many-to-many' &&
              relationship.owningSide === true
          )

        if (oppositeRelationship) {
          acc.push({
            entity: otherEntityManifest,
            relationship: oppositeRelationship
          })
        }

        return acc
      }, [])

    return oppositeRelationships.map(
      (oppositeRelationship: {
        entity: EntityManifest
        relationship: RelationshipManifest
      }) => {
        const relationship: RelationshipManifest = {
          name: pluralize(camelize(oppositeRelationship.entity.namePlural)),
          entity: oppositeRelationship.entity.className,
          eager: false,
          type: 'many-to-many',
          owningSide: false,
          inverseSide: oppositeRelationship.relationship.name
        }

        return relationship
      }
    )
  }

  /**
   * Generate the OneToOne relationships from the opposite OneToOne relationships.
   *
   * @param entityManifests The entity manifests.
   * @param currentEntityManifest The entity manifest for which to generate the OneToOne relationships.
   *
   * @returns The OneToOne relationships.
   */
  getOppositeOneToOneRelationships(
    entityManifests: EntityManifest[],
    currentEntityManifest: EntityManifest
  ): RelationshipManifest[] {
    // We need to get the entities that have OneToOne relationships to the current entity to create the opposite OneToOne relationships.
    const oppositeRelationships: {
      entity: EntityManifest
      relationship: RelationshipManifest
    }[] = entityManifests
      .filter(
        (otherEntityManifest: EntityManifest) =>
          otherEntityManifest.className !== currentEntityManifest.className
      )
      .reduce((acc, otherEntityManifest: EntityManifest) => {
        const oppositeRelationship: RelationshipManifest =
          otherEntityManifest.relationships.find(
            (relationship: RelationshipManifest) =>
              relationship.entity === currentEntityManifest.className &&
              relationship.type === 'one-to-one' &&
              relationship.owningSide === true
          )

        if (oppositeRelationship) {
          acc.push({
            entity: otherEntityManifest,
            relationship: oppositeRelationship
          })
        }

        return acc
      }, [])

    return oppositeRelationships.map(
      (oppositeRelationship: {
        entity: EntityManifest
        relationship: RelationshipManifest
      }) => {
        const relationship: RelationshipManifest = {
          name: camelize(oppositeRelationship.entity.nameSingular),
          entity: oppositeRelationship.entity.className,
          eager: !!oppositeRelationship.entity.nested,
          type: 'one-to-one',
          owningSide: false,
          inverseSide: oppositeRelationship.relationship.name,
          nested: !!oppositeRelationship.entity.nested,
          helpText: oppositeRelationship.relationship.helpText || ''
        }

        return relationship
      }
    )
  }

  /**
   * Generate a relationship name based on the relationship schema.
   *
   * @param relationship The relationship schema.
   * @param type The type of the relationship.
   *
   * @returns The generated relationship name.
   */
  static generateRelationshipName(
    relationship: RelationshipSchema,
    type: 'many-to-many' | 'many-to-one'
  ): string {
    if (type === 'many-to-one') {
      if (typeof relationship === 'string') {
        return camelize(relationship)
      }
      return camelize(relationship.name || relationship.entity)
    } else {
      // Many-to-many.
      if (typeof relationship === 'string') {
        return pluralize(camelize(relationship))
      }
      return camelize(relationship.name || relationship.entity)
    }
  }

  /**
   * Generate the entity name based on the relationship schema.
   *
   * @param relationship The relationship schema.
   *
   * @returns The entity name.
   */
  static generateRelationshipEntity(relationship: RelationshipSchema): string {
    if (typeof relationship === 'string') {
      return relationship
    }
    return relationship.entity
  }
}
