import { Injectable } from '@nestjs/common'

import Ajv from 'ajv'
// import manifestSchema from '../../json-schema/manifest-schema.json'
import schemas from '../../json-schema'

@Injectable()
export class SchemaService {
  validate(manifest: any): boolean {
    this.validateAgainstSchema(manifest, schemas[0])
    this.conditionalValidation(manifest)

    return true
  }

  private validateAgainstSchema(manifest: any, schema: any): boolean {
    const manifestSchema = schemas[0]

    let validate: any = new Ajv({
      schemas
    })
    validate = validate.getSchema(manifestSchema.$id)

    const valid = validate(manifest)

    if (!valid) {
      console.error('#### JSON Schema Validation failed ####')
      console.error(validate.errors)
      process.exit(1)
    }

    return valid
  }

  private conditionalValidation(manifest: any): boolean {
    // Validate that entities in relationships exist.

    const entities = Object.keys(manifest.entities)

    Object.values(manifest.entities).forEach((entity: any) => {
      const relationships = Object.values(entity.hasMany || {})
        .concat(Object.values(entity.belongsTo || {}))
        .map((relationship: any) => relationship.entity)

      relationships.forEach((relationship: any) => {
        if (!entities.includes(relationship)) {
          console.error(`Entity ${relationship} does not exist in the manifest`)
          process.exit(1)
        }
      })
    })

    return true
  }
}
