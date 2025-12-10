import { Injectable } from '@nestjs/common'
import { generalSchemas } from '../schemas/general-schemas'
import {
  ReferenceObject,
  SchemaObject
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import {
  EntityTsTypeInfo,
  PropertyTsTypeInfo
} from '../../entity/types/entity-ts-type-info'
import { tsTypeSchemaTypes } from '../schemas/ts-type-schema-types'
import { propTypeExamples } from '../schemas/prop-type-examples'
import { propTypeFormats } from '../schemas/prop-type-formats'
import { PropType } from '../../../../types/src'

@Injectable()
export class OpenApiSchemaService {
  /**
   * Get general schemas for the application.
   *
   * @returns The schema for the application.
   *
   **/
  getGeneralSchemas(): Record<string, SchemaObject> {
    return generalSchemas
  }

  /**
   * Get schemas for the entities in the application.
   *
   * @param entityTypeInfos - An array of EntityTypeInfo objects that describe the entities in the application.
   *
   * @return A record of entity schemas, where the key is the entity name and the value is the schema object.
   */
  generateEntitySchemas(
    entityTypeInfos: EntityTsTypeInfo[]
  ): Record<string, SchemaObject> {
    const entitySchemas: Record<string, SchemaObject> = {}

    entityTypeInfos.forEach((entityTsTypeInfo: EntityTsTypeInfo) => {
      const properties: Record<string, SchemaObject | ReferenceObject> = {}

      // Add general schemas for the entity.
      entityTsTypeInfo.properties
        .filter((property) => !property.isRelationship)
        .forEach((property: PropertyTsTypeInfo) => {
          properties[property.name] = this.generatePropertySchema(property)
        })

      if (entityTsTypeInfo.nested) {
        // For nested entities, we remove the ID property in schemas to prevent 400 responses on create/update examples with the UI.
        delete properties['id']
      }

      // Add relationship schemas for the entity.
      entityTsTypeInfo.properties
        .filter((property) => property.isRelationship)
        .forEach((property: PropertyTsTypeInfo) => {
          properties[property.name] = this.generateRelationshipSchema(property)
        })

      entitySchemas[entityTsTypeInfo.name] = {
        type: 'object',
        description: `${entityTsTypeInfo.name} entity schema`,
        properties
      }
    })

    return entitySchemas
  }

  /**
   * Generate a schema for a property.
   *
   * @param property - The property to generate the schema for.
   * @returns The schema object for the property.
   */
  private generatePropertySchema(property: PropertyTsTypeInfo): SchemaObject {
    // Special handling for image properties as the type is a custom object with sizes.
    if (property.manifestPropType === PropType.Image) {
      return {
        description: `The ${property.name} property of the entity (${property.manifestPropType})`,
        type: 'object',
        additionalProperties: false,
        example: Object.keys(property.sizes).reduce((acc, size) => {
          acc[size] = `https://example.com/image-${size}.jpg`
          return acc
        }, {}),

        required: Object.keys(property.sizes || {}),
        properties: Object.keys(property.sizes || {}).reduce((acc, size) => {
          acc[size] = {
            type: 'string',
            format: 'uri',
            description: `Image URL for size ${size}`,
            example: `https://example.com/image-${size}.jpg`
          }
          return acc
        }, {})
      }
    }

    const schema: SchemaObject = JSON.parse(
      JSON.stringify(tsTypeSchemaTypes[property.type as string] || {})
    )

    if (Object.keys(schema).length === 0) {
      throw new Error(
        `No schema found for property type: ${property.type} (${property.manifestPropType})`
      )
    }

    if (
      property.manifestPropType === PropType.Choice &&
      property.values?.length > 0
    ) {
      return {
        type: 'string',
        description: `The ${property.name} property of the entity (${property.manifestPropType})`,
        enum: property.values,
        example: property.values[0]
      }
    } else if (property.name === 'id') {
      schema.description = `The unique identifier for the entity`
      schema.format = 'uuid'
      schema.example = '123e4567-e89b-12d3-a456-426614174000'
    } else {
      schema.description = `The ${property.name} property of the entity (${property.manifestPropType})`
      schema.example = propTypeExamples[property.manifestPropType]

      const format = propTypeFormats[property.manifestPropType]
      if (format) {
        schema.format = format
      }
    }

    schema.nullable = !property.optional

    return schema
  }

  /**
   * Generate a schema for a relationship property.
   *
   * @param property - The property to generate the schema for.
   * @returns The schema object for the relationship property.
   */
  private generateRelationshipSchema(
    property: PropertyTsTypeInfo
  ): SchemaObject | ReferenceObject {
    const propertyType: string = property.type as string

    const isArray: boolean = propertyType.endsWith('[]')

    // In the case of dealing with a Dto relationship, we only get the ID (or array of IDs) of the related entity.
    if (propertyType === 'string' || propertyType === 'string[]') {
      if (isArray) {
        return {
          type: 'array',
          description: `Array of IDs for ${property.name} entities`,
          items: {
            type: 'string',
            format: 'uuid',
            example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
          }
        }
      } else {
        return {
          type: 'string',
          description: `ID of the ${property.name} entity`,
          format: 'uuid',
          example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
        }
      }
    }

    if (isArray) {
      return {
        type: 'array',
        description: `Array of ${property.name} entities`,
        items: {
          $ref: `#/components/schemas/${propertyType.replace('[]', '')}`
        }
      }
    } else {
      return {
        type: 'object',
        description: `Single ${property.name} entity`,
        $ref: `#/components/schemas/${propertyType}`
      }
    }
  }
}
