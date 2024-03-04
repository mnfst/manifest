import * as fs from 'fs'
import * as yaml from 'js-yaml'

import schema from '@casejs/json-schema/schema/app-schema.json'
import Ajv from 'ajv'

const appFile = fs.readFileSync(`${process.cwd()}/case/case.yml`, 'utf8')
const appManifest: any = yaml.load(appFile)

// TODO: Validation against JSON schema.
const validate = new Ajv().compile(schema)
const valid = validate(appManifest)

if (!valid) {
  console.error('Validation failed ####')
  console.error(validate.errors)
} else {
  console.log('Validation passed !')
}

// TODO: Extra validation steps.

// TODO: Connect with CASE.
