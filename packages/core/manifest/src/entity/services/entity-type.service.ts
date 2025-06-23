import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import {
  AppManifest,
  EntityManifest,
  PropertyManifest,
  PropType,
  RelationshipManifest
} from '../../../../types/src'
import { propTypeTsType } from '../types/prop-type-ts-type'
import { AUTHENTICABLE_PROPS } from '../../constants'

@Injectable()
export class EntityTypeService {
  constructor(private readonly manifestService: ManifestService) {}
  /**
   * Generates the entity types based on the application manifest.
   *

   * @returns An array of EntityTypeInfo objects representing the entity types.
   */
  generateEntityTypes(): string[] {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    return Object.values(appManifest.entities).map((entity) =>
      this.generateTSInterfaceFromEntityManifest(entity)
    )
  }

  /**
   * Generates a TypeScript interface from an EntityManifest.
   *
   * @param entityManifest The EntityManifest to generate the interface from.
   * @returns A string representing the TypeScript interface.
   */
  private generateTSInterfaceFromEntityManifest(
    entityManifest: EntityManifest
  ): string {
    // All properties have an id property.
    const properties: PropertyManifest[] = [
      {
        name: 'id',
        type: PropType.String
      }
    ]

    // Add authenticable properties if the entity is authenticable.
    if (entityManifest.authenticable) {
      properties.push(...AUTHENTICABLE_PROPS)
    }

    // Generate TypeScript properties from the manifest.
    const tsProperties: string[] = [...properties, ...entityManifest.properties]
      .filter((prop) => prop.hidden !== true)
      .map((prop: PropertyManifest) => {
        let tsType: string
        if (prop.type === PropType.Choice && prop.options?.values) {
          const values = prop.options.values as string[]
          tsType = values.map((val) => `'${val}'`).join(' | ')
        } else {
          tsType = propTypeTsType[prop.type]
        }

        return `  ${prop.name}: ${tsType};`
      })

    // Add relationships if they exist.
    if (entityManifest.relationships.length > 0) {
      entityManifest.relationships.forEach(
        (relationship: RelationshipManifest) => {
          if (
            relationship.type === 'many-to-many' ||
            relationship.type === 'one-to-many'
          ) {
            tsProperties.push(
              `  ${relationship.name}?: ${relationship.entity}[];`
            )
          } else {
            tsProperties.push(
              `  ${relationship.name}?: ${relationship.entity};`
            )
          }
        }
      )
    }

    return `export interface ${entityManifest.className} {\n${tsProperties.join('\n')}\n}\n`
  }
}
