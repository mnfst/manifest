import * as fs from 'fs'
import * as yaml from 'js-yaml'

import Ajv from 'ajv'
import entitySchema from './json-schema/schema/definitions/entity-schema.json'
import propertySchema from './json-schema/schema/definitions/property-schema.json'
import relationshipSchema from './json-schema/schema/definitions/relationship-schema.json'
import manifestSchema from './json-schema/schema/manifest-schema.json'

const appFile = fs.readFileSync(`${process.cwd()}/manifest/backend.yml`, 'utf8')
const appManifest: any = yaml.load(appFile)

let validate: any = new Ajv({
  schemas: [manifestSchema, entitySchema, propertySchema, relationshipSchema]
}) // options can be passed, e.g. {allErrors: true}
validate = validate.getSchema(manifestSchema.$id)

const valid = validate(appManifest)

if (!valid) {
  console.error('JSON Schema Validation failed ####')
  console.error(validate.errors)
  process.exit(1)
} else {
  console.log('## JSON Schema Validation passed !')
}

console.log('## App Manifest:', appManifest)

// 1. Extra validation Check if the entity in relationship exists.
const entities = Object.keys(appManifest.entities)

Object.values(appManifest.entities).forEach((entity: any) => {
  const relationships = Object.values(entity.hasMany || {})
    .concat(Object.values(entity.belongsTo || {}))
    .map((relationship: any) => relationship.entity)

  relationships.forEach((relationship: any) => {
    if (!entities.includes(relationship)) {
      console.error(`Entity ${relationship} does not exist in the manifest`)
    }
  })
})

// TODO: Connect with CASE.
