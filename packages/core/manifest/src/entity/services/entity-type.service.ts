import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import {
  AppManifest,
  EntityManifest,
  ImageSizesObject,
  PropertyManifest,
  PropType,
  RelationshipManifest
} from '../../../../types/src'
import { propTypeTsType } from '../types/prop-type-ts-type'
import { AUTHENTICABLE_PROPS } from '../../constants'
import {
  EntityTsTypeInfo,
  PropertyTsTypeInfo
} from '../types/entity-ts-type-info'
import { getDtoPropertyNameFromRelationship } from '../../../../common/src'

@Injectable()
export class EntityTypeService {
  constructor(private readonly manifestService: ManifestService) {}
  /**
   * Generates the entity types based on the application manifest.
   *

   * @returns An array of EntityTypeInfo objects, each representing an entity type.
   */
  generateEntityTypeInfos(): EntityTsTypeInfo[] {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    const entityTsTypeInfos: EntityTsTypeInfo[] = []

    // Generate entity TS type.
    Object.values(appManifest.entities).map((entity) =>
      entityTsTypeInfos.push(this.generateEntityTypeInfoFromManifest(entity))
    )

    // Generate CreateDTO TS type.
    Object.values(appManifest.entities)
      .filter((entity) => !entity.nested) // Nested entities cannot be created directly.
      .map((entity) => {
        entityTsTypeInfos.push(
          this.generateCreateDtoTypeInfoFromManifest(entity)
        )
      })

    return entityTsTypeInfos
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
  ): EntityTsTypeInfo {
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

    const propertyTypeInfos: PropertyTsTypeInfo[] = [
      ...properties,
      ...entityManifest.properties
    ].map((prop: PropertyManifest) => {
      const propertyTsTypeInfo: PropertyTsTypeInfo = {
        name: prop.name,
        type: propTypeTsType[prop.type] || 'any',
        manifestPropType: prop.type
      }

      if (prop.type === PropType.Choice) {
        propertyTsTypeInfo.values = (prop.options?.values as string[]) || null
      } else if (prop.type === PropType.Image) {
        propertyTsTypeInfo.type = Object.keys(
          (prop.options?.sizes as ImageSizesObject) || {}
        ).reduce(
          (
            acc: { [key: string]: { width: number; height: number } },
            size: string
          ) => {
            acc[size] = {
              width: prop.options?.sizes[size].width || 0,
              height: prop.options?.sizes[size].height || 0
            }
            return acc
          },
          {}
        )
        propertyTsTypeInfo.sizes = prop.options?.sizes as ImageSizesObject
      }

      return propertyTsTypeInfo
    })

    // Add relationships as properties if they exist.
    if (!entityManifest.nested) {
      entityManifest.relationships.forEach((relationship) => {
        if (
          relationship.type === 'many-to-many' ||
          relationship.type === 'one-to-many'
        ) {
          propertyTypeInfos.push({
            name: relationship.name,
            type: `${relationship.entity}[]`,
            isRelationship: true,
            optional: true
          })
        } else {
          propertyTypeInfos.push({
            name: relationship.name,
            type: relationship.entity,
            isRelationship: true,
            optional: true
          })
        }
      })
    }
    return {
      name: entityManifest.className,
      properties: propertyTypeInfos,
      nested: entityManifest.nested
    }
  }

  /**
   * Generates a TypeScript interface for the CreateDTO type based on the entity manifest.
   *
   * @param entityManifest The EntityManifest to generate the CreateDTO interface from.
   *
   * @returns an EntityTypeInfo object containing the name and properties of the CreateDTO.
   *
   **/
  private generateCreateDtoTypeInfoFromManifest(
    entityManifest: EntityManifest
  ): EntityTsTypeInfo {
    const properties: PropertyManifest[] = []

    // Add authenticable properties if the entity is authenticable (excluding id).
    if (entityManifest.authenticable) {
      properties.push(...AUTHENTICABLE_PROPS)
    }

    const propertyTypeInfos: PropertyTsTypeInfo[] = [
      ...properties,
      ...entityManifest.properties
    ].map((prop: PropertyManifest) => {
      const propertyTsTypeInfo: PropertyTsTypeInfo = {
        name: prop.name,
        type: propTypeTsType[prop.type] || 'any',
        manifestPropType: prop.type
      }

      if (prop.type === PropType.Choice) {
        propertyTsTypeInfo.values = (prop.options?.values as string[]) || null
      } else if (prop.type === PropType.Image) {
        propertyTsTypeInfo.sizes = prop.options?.sizes as ImageSizesObject
      }

      return propertyTsTypeInfo
    })

    // Add relationships using the helper function.
    entityManifest.relationships.forEach(
      (relationship: RelationshipManifest) => {
        // Skip standard one-to-many relationships as they are not included in CreateDTO.
        if (relationship.type === 'one-to-many' && !relationship.nested) {
          return
        }

        const dtoPropertyName = getDtoPropertyNameFromRelationship(relationship)
        const isMultiple =
          relationship.type === 'many-to-many' ||
          relationship.type === 'one-to-many'

        // For nested relationships, we pass the entire object, not just the ID.
        const type: string = relationship.nested
          ? relationship.entity
          : `string`

        propertyTypeInfos.push({
          name: dtoPropertyName,
          type: isMultiple ? `${type}[]` : type,
          isRelationship: true,
          optional: true
        })
      }
    )

    return {
      name: `CreateUpdate${entityManifest.className}Dto`,
      properties: propertyTypeInfos
    }
  }

  /**
   * Generates a string representation of a TypeScript interface from the entity type info.
   *
   * @param entityTypeInfo The EntityTypeInfo to generate the interface from.
   *
   * @returns A string representing the TypeScript interface.
   */
  generateTSInterfaceFromEntityTypeInfo(
    entityTypeInfo: EntityTsTypeInfo
  ): string {
    const tsProperties: string[] = entityTypeInfo.properties.map((prop) => {
      let tsType: string

      // Special handling for image sizes.
      if (prop.manifestPropType === PropType.Image && prop.sizes) {
        tsType = `{ ${Object.keys(prop.sizes)
          .map((size: string) => `${size}: string`)
          .join('; ')} }`
      } else if (prop.manifestPropType === PropType.Location) {
        tsType = '{ lat: number; lng: number; }'
      } else {
        tsType = prop.type as string
      }

      if (prop.values) {
        tsType = prop.values.map((val) => `'${val}'`).join(' | ')
      }
      return `  ${prop.name}${prop.optional ? '?' : ''}: ${tsType};`
    })

    return `export interface ${entityTypeInfo.name} {\n${tsProperties.join('\n')}\n}\n`
  }
}
