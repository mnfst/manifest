import { PropType } from '@repo/types'
import {
  isBoolean,
  isDate,
  isEmail,
  isNumber,
  isString,
  isURL
} from 'class-validator'

/**
 * This is a mapping of prop types to validation functions.
 *
 * @param value The value to validate.
 *
 * @returns A string with the error message if the value is invalid, otherwise null.
 *
 */
export const propTypeValidationFunctions: Record<
  PropType,
  (value: any) => string | null
> = {
  [PropType.String]: (value: any) =>
    isString(value) ? null : 'The value must be a string',
  [PropType.Number]: (value: any) =>
    isNumber(value) ? null : 'The value must be a number',

  [PropType.Link]: (value: any) =>
    isURL(value) ? null : 'The value must be a valid URL',
  [PropType.Text]: (value: any) =>
    isString(value) ? null : 'The value must be a string',
  [PropType.Money]: (value: any) => null, // TODO: Custom validation
  [PropType.Date]: (value: any) =>
    isDate(value) ? null : 'The value must be a valid date',
  [PropType.Timestamp]: (value: any) => null, // TODO: Validate that the value is a valid timestamp
  [PropType.Email]: (value: any) =>
    isEmail(value) ? null : 'The value must be a valid email address',
  [PropType.Boolean]: (value: any) =>
    isBoolean(value) ? null : 'The value must be a boolean',
  [PropType.Password]: (value: any) =>
    isString(value) ? null : 'The value must be a string',
  [PropType.Choice]: (value: any) => null, // TODO: Custom validation with context.
  [PropType.Location]: (value: any) => null // TODO: Custom validation
}
