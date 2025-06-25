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
        .filter((property) => !this.isPropertyRelationship(property))
        .forEach((property: PropertyTsTypeInfo) => {
          properties[property.name] = this.generatePropertySchema(property)
        })

      // Add relationship schemas for the entity.
      entityTsTypeInfo.properties
        .filter((property) => this.isPropertyRelationship(property))
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

  private generatePropertySchema(property: PropertyTsTypeInfo): SchemaObject {
    const schema: SchemaObject = JSON.parse(
      JSON.stringify(tsTypeSchemaTypes[property.type] || {})
    )

    if (!schema) {
      return {
        type: 'object',
        description: `Unknown type for property ${property.name}`
      }
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
    } else if (property.manifestPropType === PropType.Image) {
      schema.description = `The ${property.name} property of the entity (${property.manifestPropType})`
      schema.type = 'object'
      schema.additionalProperties = false
      schema.example = Object.keys(property.sizes).reduce((acc, size) => {
        acc[size] = `https://example.com/image-${size}.jpg`
        return acc
      }, {})
      schema.properties = Object.keys(property.sizes || {}).reduce(
        (acc, size) => {
          acc[size] = {
            type: 'string',
            format: 'uri',
            description: `Image URL for size ${size}`,
            example: `https://example.com/image-${size}.jpg`
          }
          return acc
        },
        {}
      )

      schema.required = Object.keys(property.sizes || {})
    } else {
      schema.description = `The ${property.name} property of the entity (${property.manifestPropType})`
      schema.example = propTypeExamples[property.manifestPropType]

      const format = propTypeFormats[property.manifestPropType]
      if (format) {
        schema.format = format
      }
    }

    if (property.optional) {
      schema.nullable = true
    }

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
    const isArray: boolean = property.type.endsWith('[]')

    if (isArray) {
      return {
        type: 'array',
        description: `Array of ${property.name} entities`,
        items: {
          $ref: `#/components/schemas/${property.type.replace('[]', '')}`
        }
      }
    } else {
      return {
        type: 'object',
        description: `Single ${property.name} entity`,
        $ref: `#/components/schemas/${property.type}`
      }
    }
  }

  /**
   * Check if the property is a relationship.
   *
   * @param property - The property to check.
   * @returns True if the property is a relationship, false otherwise.
   */
  private isPropertyRelationship(property: PropertyTsTypeInfo): boolean {
    return property.manifestPropType === null
  }
}
