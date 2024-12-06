import { Injectable } from '@nestjs/common'

import { Manifest, RelationshipSchema, EntitySchema } from '@repo/types'
import Ajv from 'ajv'
import schemas from '../json-schema'
import chalk from 'chalk'

@Injectable()
export class SchemaService {
  /**
   *
   * Validate the manifest against the JSON schema and custom logic.
   *
   * @param manifest the manifest to validate
   *
   * @returns true if the manifest is valid, otherwise throws an error.
   */
  validate(manifest: Manifest): boolean {
    this.validateAgainstSchema(manifest, schemas[0])
    this.validateCustomLogic(manifest)

    return true
  }

  /**
   *
   * Validate the manifest against the JSON schema.
   *
   * @param manifest the manifest to validate
   * @param schema the schema to validate against
   *
   * @returns true if the manifest is valid, otherwise throws an error.
   */
  validateAgainstSchema(manifest: Manifest, schema: any): boolean {
    let validate: any = new Ajv({
      schemas
    })
    validate = validate.getSchema(schema.$id)

    const valid = validate(manifest)

    if (!valid) {
      console.log(
        chalk.red('JSON Schema Validation failed. Please fix the following:')
      )

      validate.errors.forEach((error: any) => {
        console.log(chalk.red(JSON.stringify(error, null, 2)))
      })
      process.exit(1)
    }

    return true
  }

  /**
   *
   * Validate custom logic that cannot be expressed in the JSON schema.
   *
   * @param manifest the manifest to validate
   *
   * @returns true if the manifest is valid, otherwise throws an error.
   */
  validateCustomLogic(manifest: Manifest): boolean {
    // 1.Validate that all entities in relationships exist.
    const entityNames: string[] = Object.keys(manifest.entities || {})
    Object.values(manifest.entities || {}).forEach((entity: EntitySchema) => {
      const relationshipNames = Object.values(entity.belongsTo || []).map(
        (relationship: RelationshipSchema) => {
          if (typeof relationship === 'string') {
            return relationship
          }
          return relationship.entity
        }
      )

      relationshipNames.forEach((relationship: any) => {
        if (!entityNames.includes(relationship)) {
          console.log(
            chalk.red(
              'JSON Schema Validation failed. Please fix the following:'
            )
          )

          console.log(
            chalk.red(`Entity ${relationship} does not exist in the manifest`)
          )
          process.exit(1)
        }
      })
    })
    // TODO: Same for policies "allow".

    return true
  }
}
