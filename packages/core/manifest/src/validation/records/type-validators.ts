import { PropType } from '@repo/types'
import {
  isBoolean,
  isDateString,
  isEmail,
  isIn,
  isLatLong,
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
export const typeValidators: Record<
  PropType,
  (value: unknown, options?: Record<string, unknown>) => string | null
> = {
  [PropType.String]: (value: string) =>
    isString(value) ? null : 'The value must be a string',

  [PropType.Number]: (value: number) =>
    isNumber(value) ? null : 'The value must be a number',

  [PropType.Link]: (value: string) =>
    isURL(value) ? null : 'The value must be a valid URL',

  [PropType.Text]: (value: string) =>
    isString(value) ? null : 'The value must be a string',

  // Custom validation for money: The value must be a number with up to 2 decimal places.
  [PropType.Money]: (value: number) =>
    typeof value === 'number' && /^\d+(\.\d{1,2})?$/.test(value.toString())
      ? null
      : 'The value must be a number with up to 2 decimal places',

  [PropType.Date]: (value: string) =>
    isDateString(value) ? null : 'The value must be a valid date',

  [PropType.Timestamp]: (value: number) =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value < Date.now()
      ? null
      : 'The value must be a valid timestamp',

  [PropType.Email]: (value: string) =>
    isEmail(value) ? null : 'The value must be a valid email address',

  [PropType.Boolean]: (value: boolean) =>
    isBoolean(value) ? null : 'The value must be a boolean',

  [PropType.Password]: (value: string) =>
    isString(value) ? null : 'The value must be a string', // TODO: Manage updates

  [PropType.Choice]: (value: any, options: { values: any[] }) =>
    isIn(value, options.values)
      ? null
      : 'The value must be one of the available choices',

  [PropType.Location]: (value: { lat: string; lng }) =>
    value.lat && value.lng && isLatLong(`${value.lat},${value.lng}`)
      ? null
      : 'The value must be a valid latitude and longitude'
}
