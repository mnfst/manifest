import { PropType } from '@repo/types'
import {
  isBoolean,
  isDateString,
  isEmail,
  isISO8601,
  isIn,
  isLatLong,
  isNumber,
  isString,
  isURL
} from 'class-validator'

/**
 * This is a mapping of prop types to validation functions. Each prop type has a built-in corresponding validation function.
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

  [PropType.RichText]: (value: string) =>
    isString(value) ? null : 'The value must be a string',

  // Custom validation for money: The value must be a number with up to 2 decimal places.
  [PropType.Money]: (value: number) =>
    typeof value === 'number' && /^\d+(\.\d{1,2})?$/.test(value.toString())
      ? null
      : 'The value must be a number with up to 2 decimal places',

  // Combine isDateString from class-validator with a custom regex to validate the YYYY-MM-DD format.
  [PropType.Date]: (value: string) =>
    isDateString(value) && new RegExp(/^\d{4}-\d{2}-\d{2}$/).test(value)
      ? null
      : 'The value must be a valid date',

  [PropType.Timestamp]: (value: number) =>
    isISO8601(value) ? null : 'The value must be a valid timestamp',

  [PropType.Email]: (value: string) =>
    isEmail(value) ? null : 'The value must be a valid email address',

  [PropType.Boolean]: (value: boolean) =>
    isBoolean(value) ? null : 'The value must be a boolean',

  [PropType.Password]: (value: string) =>
    isString(value) ? null : 'The value must be a string', // TODO: Manage updates

  [PropType.Choice]: (value: string, options: { values: string[] }) =>
    isIn(value, options.values)
      ? null
      : 'The value must be one of the available choices',

  [PropType.Location]: (value: { lat: string; lng }) =>
    typeof value.lat !== 'undefined' &&
    typeof value.lng !== 'undefined' &&
    isLatLong(`${value.lat},${value.lng}`)
      ? null
      : 'The value must be a valid latitude and longitude',

  [PropType.File]: () => null, // TODO: Type validators for files
  [PropType.Image]: () => null // TODO: Type validators for images
}
