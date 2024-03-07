import { Injectable } from '@nestjs/common'

import Ajv from 'ajv'
// import manifestSchema from '../../json-schema/manifest-schema.json'
import schemas from '../../json-schema'

@Injectable()
export class SchemaService {
  validate(manifest: any): boolean {
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
}
