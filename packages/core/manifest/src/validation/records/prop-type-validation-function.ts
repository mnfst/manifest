import { PropType } from '@repo/types'
import { isNumber, isString } from 'class-validator'

// This is a mapping of prop types to validation functions.
export const propTypeValidationFunctions: Record<
  PropType,
  (value: any) => boolean
> = {
  [PropType.String]: (value: any) => isString(value),
  [PropType.Number]: (value: any) => isNumber(value),

  // TODO: Validators
  [PropType.Link]: (value: any) => false,
  [PropType.Text]: (value: any) => false,
  [PropType.Money]: (value: any) => false,
  [PropType.Date]: (value: any) => false,
  [PropType.Timestamp]: (value: any) => false,
  [PropType.Email]: (value: any) => false,
  [PropType.Boolean]: (value: any) => false,
  [PropType.Password]: (value: any) => false,
  [PropType.Choice]: (value: any) => false,
  [PropType.Location]: (value: any) => false
}
