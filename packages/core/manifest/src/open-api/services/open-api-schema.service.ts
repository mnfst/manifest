import { Injectable } from '@nestjs/common'
import { generalSchemas } from '../schemas/general-schemas'
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import {
  EntityTypeInfo,
  PropertyTypeInfo
} from '../../entity/types/entity-type-info'
import { tsTypeSchemaTypes } from '../schemas/ts-type-schema-types'

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
    entityTypeInfos: EntityTypeInfo[]
  ): Record<string, SchemaObject> {
    const entitySchemas: Record<string, SchemaObject> = {}

    entityTypeInfos.forEach((entityTypeInfo: EntityTypeInfo) => {
      const properties: Record<string, SchemaObject> = {}

      entityTypeInfo.properties.forEach((property: PropertyTypeInfo) => {
        properties[property.name] = this.generatePropertySchema(property)
      })

      entitySchemas[entityTypeInfo.name] = {
        type: 'object',
        description: `${entityTypeInfo.name} entity schema`,
        properties
      }
    })

    return entitySchemas
  }

  private generatePropertySchema(property: PropertyTypeInfo): SchemaObject {
    const schema: SchemaObject = JSON.parse(
      JSON.stringify(tsTypeSchemaTypes[property.type] || {})
    )

    if (!schema) {
      return {
        type: 'object',
        description: `Unknown type for property ${property.name}`
      }
    }

    if (property.values?.length > 0) {
      return {
        type: 'string',
        enum: property.values,
        example: property.values[0]
      }
    }

    if (property.name === 'id') {
      schema.description = `The unique identifier for the entity`
      schema.format = 'uuid'
    }

    if (property.optional) {
      schema.nullable = true
    }

    console.log(schema)
    return schema
  }
}
