import * as fs from 'fs'
import * as yaml from 'js-yaml'

import Ajv from 'ajv'
import entitySchema from './json-schema/schema/definitions/entity-schema.json'
import propertySchema from './json-schema/schema/definitions/property-schema.json'
import relationshipSchema from './json-schema/schema/definitions/relationship-schema.json'
import manifestSchema from './json-schema/schema/manifest-schema.json'

const appFile = fs.readFileSync(`${process.cwd()}/manifest/backend.yml`, 'utf8')
const appManifest: any = yaml.load(appFile)

// TODO: Validation against JSON schema.
let validate: any = new Ajv({
  schemas: [manifestSchema, entitySchema, propertySchema, relationshipSchema]
}) // options can be passed, e.g. {allErrors: true}
validate = validate.getSchema(manifestSchema.$id)

const valid = validate(appManifest)

if (!valid) {
  console.error('Validation failed ####')
  console.error(validate.errors)
} else {
  console.log('## Validation passed !')
}

// TODO: Extra validation steps

// TODO: Connect with CASE.
