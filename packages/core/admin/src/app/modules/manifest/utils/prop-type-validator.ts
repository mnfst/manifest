import { AbstractControl, ValidationErrors } from '@angular/forms'
import { PropType } from '../../../../../../types/src'

// Custom validator to ensure the value is a valid PropType enum
export const propTypeValidator = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value
  if (!value) {
    return null // Let the required validator handle empty values
  }

  const validPropTypes = Object.values(PropType)
  if (!validPropTypes.includes(value)) {
    return { invalidPropType: { value, validTypes: validPropTypes } }
  }

  return null
}
