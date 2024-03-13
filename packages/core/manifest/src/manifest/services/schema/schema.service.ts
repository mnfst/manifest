import { Injectable } from '@nestjs/common'

import Ajv from 'ajv'
// import manifestSchema from '../../json-schema/manifest-schema.json'
import schemas from '../../json-schema'
import {
  AppManifest,
  EntityManifest,
  RelationshipManifest
} from '../../typescript/manifest-types'

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
  validate(manifest: AppManifest): boolean {
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
  validateAgainstSchema(manifest: AppManifest, schema: any): boolean {
    let validate: any = new Ajv({
      schemas
    })
    validate = validate.getSchema(schema.$id)

    const valid = validate(manifest)

    if (!valid) {
      console.error('#### JSON Schema Validation failed ####')
      console.error(validate.errors)
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
  validateCustomLogic(manifest: AppManifest): boolean {
    // 1.Validate that all entities in relationships exist.
    const entityNames: string[] = Object.keys(manifest.entities)

    Object.values(manifest.entities).forEach((entity: EntityManifest) => {
      const relationshipNames = Object.values(entity.hasMany || [])
        .concat(Object.values(entity.belongsTo || []))
        .map((relationship: RelationshipManifest) => relationship.entity)

      relationshipNames.forEach((relationship: any) => {
        if (!entityNames.includes(relationship)) {
          console.error(`Entity ${relationship} does not exist in the manifest`)
          process.exit(1)
        }
      })
    })

    return true
  }
}
