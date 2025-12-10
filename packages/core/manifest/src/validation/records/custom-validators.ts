import {
  min,
  max,
  isEmpty,
  isDefined,
  equals,
  notEquals,
  isIn,
  isNotIn,
  contains,
  notContains,
  isAlpha,
  isAlphanumeric,
  isAscii,
  isEmail,
  isJSON,
  minLength,
  maxLength,
  matches,
  isNotEmpty
} from 'class-validator'
import { ValidationManifest } from '@repo/types'

/*
 * Custom validators based on class-validator.
 * Each ValidationManifest property specified has a corresponding custom validator.
 */
export const customValidators: Record<
  keyof ValidationManifest,
  (value: unknown, context: unknown) => string | null
> = {
  min: (propValue: any, minValue: number) =>
    min(propValue, minValue)
      ? null
      : `The value must be greater than or equal to ${minValue}`,

  max: (propValue: any, maxValue: number) =>
    max(propValue, maxValue)
      ? null
      : `The value must be less than or equal to ${maxValue}`,

  isEmpty: (propValue: any, isFilterActive: boolean) =>
    !isFilterActive || isEmpty(propValue) ? null : 'The value must be empty',

  isNotEmpty: (propValue: any, isFilterActive: boolean) =>
    !isFilterActive || isNotEmpty(propValue)
      ? null
      : 'The value must not be empty',

  required: (propValue: any, isFilterActive: boolean) =>
    !isFilterActive || isNotEmpty(propValue) ? null : 'The value is required',

  isDefined: (propValue: any, isFilterActive: boolean) =>
    !isFilterActive || isDefined(propValue)
      ? null
      : 'The value must be defined',

  equals: (propValue: any, comparison: any) =>
    equals(propValue, comparison)
      ? null
      : `The value must be equal to ${comparison}`,

  notEquals: (propValue: any, comparison: any) =>
    notEquals(propValue, comparison)
      ? null
      : `The value must not be equal to ${comparison}`,

  isIn: (propValue: any, values: any[]) =>
    isIn(propValue, values) ? null : `The value must be one of ${values}`,

  isNotIn: (propValue: any, values: any[]) =>
    isNotIn(propValue, values)
      ? null
      : `The value must not be one of ${values}`,

  contains: (propValue: any, seed: any) =>
    contains(propValue, seed) ? null : `The value must contain ${seed}`,

  notContains: (propValue: any, seed: any) =>
    notContains(propValue, seed) ? null : `The value must not contain ${seed}`,

  isAlpha: (propValue: any, isFilterActive: boolean) =>
    !isFilterActive || isAlpha(propValue)
      ? null
      : 'The value must contain only letters (a-zA-Z)',

  isAlphanumeric: (propValue: any, isFilterActive: boolean) =>
    !isFilterActive || isAlphanumeric(propValue)
      ? null
      : 'The value must contain only letters and numbers',

  isAscii: (propValue: any, isFilterActive: boolean) =>
    !isFilterActive || isAscii(propValue)
      ? null
      : 'The value must contain only ASCII characters',

  isEmail: (propValue: string, isFilterActive: boolean) =>
    !isFilterActive || isEmail(propValue)
      ? null
      : 'The value must be a valid email address',

  isJSON: (propValue: unknown, isFilterActive: boolean) =>
    !isFilterActive || isJSON(propValue)
      ? null
      : 'The value must be a valid JSON string',

  minLength: (propValue: unknown, min: number) =>
    minLength(propValue, min)
      ? null
      : `The value must be at least ${min} characters long`,

  maxLength: (propValue: unknown, max: number) =>
    maxLength(propValue, max)
      ? null
      : `The value must be at most ${max} characters long`,

  matches: (propValue: string, pattern: RegExp) =>
    matches(propValue, pattern)
      ? null
      : `The value must match the pattern ${pattern}`,

  // IsOptional is a special case that always returns null. The logic is handled in the validation service.
  isOptional: (propValue: any, context: any) => null
}
