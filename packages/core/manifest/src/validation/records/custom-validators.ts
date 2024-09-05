import { min, max, isEmpty } from 'class-validator'
import { ValidationManifest } from '@repo/types'

export const customValidators: Record<
  keyof ValidationManifest,
  (value: any, context: any) => string | null
> = {
  min: (propValue: any, minValue: number) =>
    min(propValue, minValue)
      ? null
      : `The value must be greater than or equal to ${minValue}`,

  max: (propValue: any, maxValue: number) =>
    max(propValue, maxValue)
      ? null
      : `The value must be less than or equal to ${maxValue}`,

  isEmpty: (propValue: any) =>
    isEmpty(propValue) ? null : 'The value must be empty',

  isNotEmpty: (propValue: any) =>
    isEmpty(propValue) ? 'The value must not be empty' : null

  // TODO: Add all validators.
}
