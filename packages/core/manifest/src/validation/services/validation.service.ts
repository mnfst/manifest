import { EntityManifest, PropertyManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { ValidationError } from 'class-validator'
import { propTypeValidationFunctions } from '../records/prop-type-validation-function'

@Injectable()
export class ValidationService {
  /**
   *
   * Validate an item DTO against an entity manifest.
   *
   * @param itemDto The item DTO to validate.
   * @param entity The entity manifest to validate against.
   *
   * @returns A promise of an array of validation errors.
   *
   */
  validate(itemDto: any, entityManifest: EntityManifest): ValidationError[] {
    const errors: ValidationError[] = []

    entityManifest.properties.forEach((propertyManifest: PropertyManifest) => {
      const propValue: any = itemDto[propertyManifest.name]

      errors.push(...this.validateProperty(propValue, propertyManifest))
    })

    return errors
  }

  /**
   *
   * Validate a property against a property manifest.
   *
   * @param propValue The property value to validate.
   * @param propertyManifest The property manifest to validate against.
   *
   * @returns A promise of an array of validation errors.
   *
   */
  validateProperty(
    propValue: any,
    propertyManifest: PropertyManifest
  ): ValidationError[] {
    const errors: ValidationError[] = []

    // Validate that the property value is of the correct type based on PropType.
    if (typeof propValue !== 'undefined') {
      const typeValidationError: string | null =
        propTypeValidationFunctions[propertyManifest.type](propValue)
      if (typeValidationError) {
        errors.push({
          property: propertyManifest.name,
          constraints: {
            type: typeValidationError
          }
        })
      }
    }

    return errors
  }
}
