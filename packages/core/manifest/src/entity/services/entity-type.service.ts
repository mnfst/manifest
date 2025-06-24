import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import {
  AppManifest,
  EntityManifest,
  PropertyManifest,
  PropType
} from '../../../../types/src'
import { propTypeTsType } from '../types/prop-type-ts-type'
import { AUTHENTICABLE_PROPS } from '../../constants'
import { EntityTypeInfo } from '../types/entity-type-info'

@Injectable()
export class EntityTypeService {
  constructor(private readonly manifestService: ManifestService) {}
  /**
   * Generates the entity types based on the application manifest.
   *

   * @returns An array of EntityTypeInfo objects, each representing an entity type.
   */
  generateEntityTypeInfos(): EntityTypeInfo[] {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    return Object.values(appManifest.entities).map((entity) =>
      this.generateEntityTypeInfoFromManifest(entity)
    )
  }

  /**
   * Generates a TypeScript interface for the entity type based on the entity manifest.
   *
   * @param entityManifest The EntityManifest to generate the interface from.
   *
   * @returns an EntityTypeInfo object containing the name and properties of the entity.
   *
   **/
  private generateEntityTypeInfoFromManifest(
    entityManifest: EntityManifest
  ): EntityTypeInfo {
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

    const propertyTypeInfos: EntityTypeInfo['properties'] = [
      ...properties,
      ...entityManifest.properties
    ].map((prop: PropertyManifest) => {
      const type = propTypeTsType[prop.type] || 'any'
      return {
        name: prop.name,
        type,
        values:
          prop.type === PropType.Choice
            ? (prop.options?.values as string[]) || null
            : undefined
      }
    })

    // Add relationships as properties if they exist.
    entityManifest.relationships.forEach((relationship) => {
      if (
        relationship.type === 'many-to-many' ||
        relationship.type === 'one-to-many'
      ) {
        propertyTypeInfos.push({
          name: relationship.name,
          type: `${relationship.entity}[]`,
          optional: true
        })
      } else {
        propertyTypeInfos.push({
          name: relationship.name,
          type: relationship.entity,
          optional: true
        })
      }
    })

    return {
      name: entityManifest.className,
      properties: propertyTypeInfos
    }
  }

  /**
   * Generates a TypeScript interface from the entity type info.
   *
   * @param entityTypeInfo The EntityTypeInfo to generate the interface from.
   *
   * @returns A string representing the TypeScript interface.
   */
  generateTSInterfaceFromEntityTypeInfo(
    entityTypeInfo: EntityTypeInfo
  ): string {
    const tsProperties: string[] = entityTypeInfo.properties.map((prop) => {
      let tsType: string = prop.type
      if (prop.values) {
        tsType = prop.values.map((val) => `'${val}'`).join(' | ')
      }
      return `  ${prop.name}${prop.optional ? '?' : ''}: ${tsType};`
    })

    return `export interface ${entityTypeInfo.name} {\n${tsProperties.join('\n')}\n}\n`
  }
}
