import { Injectable } from '@nestjs/common'
import {
  EntityManifest,
  PropertyManifest,
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
    if (type === 'many-to-one') {
      if (typeof relationship === 'string') {
        return {
          name: camelize(relationship),
          entity: relationship,
          eager: false,
          type
        }
      }
      return {
        name: camelize(relationship.name || relationship.entity),
        entity: relationship.entity,
        eager: relationship.eager || false,
        helpText: relationship.helpText || '',
        type
      }
    } else {
      // Many-to-many.
      if (typeof relationship === 'string') {
        return {
          name: pluralize(camelize(relationship)),
          entity: relationship,
          eager: false,
          type,
          owningSide: true,
          inverseSide: pluralize(camelize(entityClassName))
        }
      }
      return {
        name: pluralize(camelize(relationship.name || relationship.entity)),
        entity: relationship.entity,
        eager: relationship.eager || false,
        helpText: relationship.helpText || '',
        type,
        owningSide: true,
        inverseSide: pluralize(camelize(entityClassName))
      }
    }
  }

  /**
   * Transform a "group" property manifest into a relationship manifest.
   * This is used for group properties to create a relationship to the group entity.
   *
   * @param property The property manifest to transform.
   *
   * @returns The relationship manifest.
   */
  transformGroupPropertyIntoRelationship(
    property: PropertyManifest
  ): RelationshipManifest {
    return {
      name: camelize(property.name),
      entity: property.options?.group as string,
      eager: true,
      type: 'one-to-many',
      nested: true
    }
  }

  /**
   * Generate the OneToMany relationships from the opposite ManyToOne relationships.
   *
   * @param entityManifests The entity manifests.
   * @param currentEntityManifest The entity manifest for which to generate the OneToMany relationships.
   *
   * @returns The OneToMany relationships.
   */
  getOneToManyRelationships(
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
          eager: false,
          type: 'one-to-many',
          inverseSide: oppositeRelationship.relationship.name
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
}
