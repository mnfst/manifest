import { EntityManifest, PropertyManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { ValidationError } from 'class-validator'
import { typeValidators } from '../records/type-validators'
import { customValidators } from '../records/custom-validators'

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
    if (typeof propValue !== 'undefined' && propValue !== null) {
      const typeValidationError: string | null = typeValidators[
        propertyManifest.type
      ](propValue, propertyManifest.options)
      if (typeValidationError) {
        errors.push({
          property: propertyManifest.name,
          value: propValue,
          constraints: {
            type: typeValidationError
          }
        })
      }
    }

    // Validate the property value against the validation schema.
    Object.entries(propertyManifest.validation || {}).forEach(
      ([key, context]: [string, any]) => {
        let validationError: string | null

        // If the property is optional and the value is undefined or null, skip validation.
        if (
          propertyManifest.validation.isOptional &&
          (propValue === undefined || propValue === null)
        ) {
          validationError = null
        } else {
          validationError = customValidators[key](propValue, context)
        }

        if (validationError) {
          const existingPropertyError = errors.find(
            (error) => error.property === propertyManifest.name
          )

          if (existingPropertyError) {
            existingPropertyError.constraints = {
              ...existingPropertyError.constraints,
              [key]: validationError
            }
          } else {
            errors.push({
              property: propertyManifest.name,
              value: propValue,
              constraints: {
                [key]: validationError
              }
            })
          }
        }
      }
    )

    return errors
  }
}
