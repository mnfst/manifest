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
   * @param throwErrors whether to throw errors or not. If set to false (default), the function will console log the errors and exit the process.
   *
   * @returns true if the manifest is valid, otherwise throws an error.
   */
  validate(manifest: Manifest, throwErrors: boolean = false): boolean {
    this.validateAgainstSchema(manifest, schemas[0], throwErrors)
    this.validateCustomLogic(manifest, throwErrors)

    return true
  }

  /**
   *
   * Validate the manifest against the JSON schema.
   *
   * @param manifest the manifest to validate
   * @param schema the schema to validate against
   * @param throwErrors whether to throw errors or not. If set to false (default), the function will console log the errors and exit the process.
   *
   * @returns true if the manifest is valid, otherwise throws an error.
   */
  validateAgainstSchema(
    manifest: Manifest,
    schema: any,
    throwErrors: boolean
  ): boolean {
    let validate: any = new Ajv({
      schemas,
      allowUnionTypes: true
    })
    validate = validate.getSchema(schema.$id)

    const valid = validate(manifest)

    if (!valid) {
      this.logValidationError(
        'JSON Schema Validation failed. Please fix the following: \n' +
          validate.errors
            .map(
              (err: any) =>
                `\n - ${JSON.stringify(err, null, 2).replace(/\n/g, '\n   ')}`
            )
            .join(''),
        throwErrors
      )
    }

    return true
  }

  /**
   *
   * Validate custom logic that cannot be expressed in the JSON schema.
   *
   * @param manifest the manifest to validate
   * @param throwErrors whether to throw errors or not. If set to false (default), the function will console log the errors and exit the process.
   *
   * @returns true if the manifest is valid, otherwise throws an error.
   */
  validateCustomLogic(manifest: Manifest, throwErrors: boolean): boolean {
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
            `Entity ${entityName} has duplicate relationship names : ${relationshipNames.join(', ')}`,
            throwErrors
          )
        }

        // Validate that all entities in relationships exist.
        relationshipNames.forEach((relationship: string) => {
          if (!entityNames.includes(relationship)) {
            this.logValidationError(
              `Entity ${relationship} in relationships does not exist`,
              throwErrors
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
                  `Entity ${allowedEntityName} in policies does not exist`,
                  throwErrors
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
            this.logValidationError(
              `Group ${propertyGroup} does not exist`,
              throwErrors
            )
          }
        })
      }
    )

    // Validate that many-to-many relationships are only declared on one side (owning side)
    this.validateManyToManyOwnership(manifest.entities || {}, throwErrors)

    // Validate that groups cannot have nested group properties.
    Object.values(manifest.groups || {}).forEach((group: GroupSchema) => {
      group.properties.forEach((property: PropertySchema) => {
        if (typeof property === 'string') {
          return
        }

        if (property.type === 'group') {
          this.logValidationError(
            `Groups cannot have nested group properties.`,
            throwErrors
          )
        }
      })
    })

    return true
  }

  /**
   * Log a validation error and exit the process.
   *
   * @param message The error message to log.
   * @param throwErrors Whether to throw errors or not.
   */
  logValidationError(message: string, throwErrors: boolean): void {
    if (throwErrors) {
      throw new Error(message)
    }

    console.log('')
    console.log(
      chalk.red(
        '┌─────────────────────────────────────────────────────────────┐'
      )
    )
    console.log(
      chalk.red('│                      ') +
        chalk.red.bold('VALIDATION FAILED') +
        chalk.red('                      │')
    )
    console.log(
      chalk.red(
        '└─────────────────────────────────────────────────────────────┘'
      )
    )
    console.log('')
    console.log(chalk.red('❌ ') + chalk.bold('Error: ') + chalk.white(message))
    console.log('')
    console.log(
      chalk.yellow('💡 ') +
        chalk.dim('Please fix the above issue and try again.')
    )
    console.log('')
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

  /**
   * Validate that many-to-many relationships are only declared on one side (owning side).
   * Both entities in a many-to-many relationship should not have belongsToMany declarations.
   *
   * @param entities The entities object from the manifest
   * @param throwErrors Whether to throw errors or not.
   */
  private validateManyToManyOwnership(
    entities: { [key: string]: EntitySchema },
    throwErrors: boolean
  ): void {
    // Track all many-to-many relationships by creating a unique key for each pair
    const manyToManyPairs: Set<string> = new Set()

    Object.entries(entities).forEach(
      ([entityName, entity]: [string, EntitySchema]) => {
        if (!entity.belongsToMany) {
          return
        }

        entity.belongsToMany.forEach((relationship: RelationshipSchema) => {
          const targetEntity =
            typeof relationship === 'string'
              ? relationship
              : relationship.entity

          // Create a normalized pair key (alphabetically ordered to ensure consistency)
          const pairKey = [entityName, targetEntity].sort().join('|')

          if (manyToManyPairs.has(pairKey)) {
            this.logValidationError(
              `Many-to-many relationship between ${entityName} and ${targetEntity} is declared on both entities. Only one entity should declare the belongsToMany relationship (the owning side).`,
              throwErrors
            )
          }

          manyToManyPairs.add(pairKey)
        })
      }
    )
  }
}
