import { Injectable } from '@nestjs/common'

import {
  Manifest,
  RelationshipSchema,
  EntitySchema,
  PropertySchema,
  PoliciesSchema,
  PolicySchema,
  GroupSchema
} from '@repo/types'
import Ajv from 'ajv'
import schemas from '@repo/json-schema'
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
      schemas,
      allowUnionTypes: true
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
    const entityNames: string[] = Object.keys(manifest.entities || {})
    const groupNames: string[] = Object.keys(manifest.groups || {})

    Object.entries(manifest.entities || {}).forEach(
      ([entityName, entity]: [string, EntitySchema]) => {
        const relationshipNames = Object.values(entity.belongsTo || []).map(
          (relationship: RelationshipSchema) => {
            if (typeof relationship === 'string') {
              return relationship
            }
            return relationship.entity
          }
        )

        // Validate that entity relationship names are unique.
        const uniqueRelationshipNames = new Set(relationshipNames)
        if (uniqueRelationshipNames.size !== relationshipNames.length) {
          this.logValidationError(
            `Entity ${entityName} has duplicate relationship names : ${relationshipNames.join(', ')}`
          )
        }

        // Validate that all entities in relationships exist.
        relationshipNames.forEach((relationship: any) => {
          if (!entityNames.includes(relationship)) {
            this.logValidationError(
              `Entity ${relationship} in relationships does not exist`
            )
          }
        })

        // Validate that entities in policies exist
        this.flattenPolicies(entity.policies).forEach(
          (policySchema: PolicySchema) => {
            if (!policySchema.allow) {
              return
            }

            if (typeof policySchema.allow === 'string') {
              policySchema.allow = [policySchema.allow] // Force array.
            }

            policySchema.allow.forEach((allowedEntityName: string) => {
              if (!entityNames.includes(allowedEntityName)) {
                this.logValidationError(
                  `Entity ${allowedEntityName} in policies does not exist`
                )
              }
            })
          }
        )

        // Validate that all groups exist.
        const groupProperties: PropertySchema[] = entity.properties
          .filter((property: PropertySchema) => typeof property !== 'string')
          .filter((property: PropertySchema) => property['options']?.group)

        groupProperties.forEach((property: PropertySchema) => {
          const propertyGroup: string = (property as any).options?.group

          if (propertyGroup && !groupNames.includes(propertyGroup)) {
            this.logValidationError(`Group ${propertyGroup} does not exist`)
          }
        })
      }
    )

    // Validate that groups cannot have nested group properties.
    Object.values(manifest.groups || {}).forEach((group: GroupSchema) => {
      group.properties.forEach((property: PropertySchema) => {
        if (typeof property === 'string') {
          return
        }

        if (property.type === 'group') {
          this.logValidationError(`Groups cannot have nested group properties.`)
        }
      })
    })

    return true
  }

  logValidationError(message: string): void {
    console.log(chalk.red(''))
    console.log(chalk.red('Validation failed. Please fix the following:'))
    console.log(chalk.red(''))
    console.log(chalk.red('    - ' + message))
    console.log(chalk.red(''))
    process.exit(1)
  }

  private flattenPolicies(policies: PoliciesSchema): PolicySchema[] {
    const result: PolicySchema[] = []

    // Iterate through all possible keys
    const keys: (keyof PoliciesSchema)[] = [
      'create',
      'read',
      'update',
      'delete',
      'signup'
    ]

    keys.forEach((key) => {
      if (policies?.[key]) {
        result.push(...policies[key]!)
      }
    })

    return result
  }
}
