import { PropType } from '@mnfst/types'
import { isNumber, isString } from 'class-validator'

// This is a mapping of prop types to validation functions.
export const propTypeValidationFunctions: Record<
  PropType,
  (value: any) => boolean
> = {
  [PropType.String]: (value) => isString(value),
  [PropType.Number]: (value) => isNumber(value),

  // TODO: Validators
  [PropType.Link]: (value) => false,
  [PropType.Text]: (value) => false,
  [PropType.Money]: (value) => false,
  [PropType.Date]: (value) => false,
  [PropType.Timestamp]: (value) => false,
  [PropType.Email]: (value) => false,
  [PropType.Boolean]: (value) => false,
  [PropType.Password]: (value) => false,
  [PropType.Choice]: (value) => false,
  [PropType.Location]: (value) => false
}
