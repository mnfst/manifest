import {
  min,
  max,
  isEmpty,
  isDefined,
  equals,
  notEquals,
  isIn,
  isNotIn,
  minDate,
  maxDate,
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
  isMimeType,
  arrayContains,
  arrayNotContains,
  arrayNotEmpty,
  arrayMinSize,
  arrayMaxSize,
  isNotEmpty
} from 'class-validator'
import { ValidationManifest } from '@repo/types'

/*
 * Custom validators based on class-validator.
 * Each ValidationManifest property specified has a corresponding custom validator.
 */
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
    isEmpty(propValue) ? 'The value must not be empty' : null,

  required: (propValue: any) =>
    isNotEmpty(propValue) ? null : 'The value is required',

  isDefined: (propValue: any) =>
    isDefined(propValue) ? null : 'The value must be defined',

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

  minDate: (propValue: any, date: Date | (() => Date)) =>
    minDate(propValue, date)
      ? null
      : `The value must be greater than or equal to ${date}`,

  maxDate: (propValue: any, date: Date | (() => Date)) =>
    maxDate(propValue, date)
      ? null
      : `The value must be less than or equal to ${date}`,

  contains: (propValue: any, seed: any) =>
    contains(propValue, seed) ? null : `The value must contain ${seed}`,

  notContains: (propValue: any, seed: any) =>
    notContains(propValue, seed) ? null : `The value must not contain ${seed}`,

  isAlpha: (propValue: any) =>
    isAlpha(propValue) ? null : 'The value must contain only letters (a-zA-Z)',

  isAlphanumeric: (propValue: any) =>
    isAlphanumeric(propValue)
      ? null
      : 'The value must contain only letters and numbers',

  isAscii: (propValue: any) =>
    isAscii(propValue) ? null : 'The value must contain only ASCII characters',

  isEmail: (propValue: any) =>
    isEmail(propValue) ? null : 'The value must be a valid email address',

  isJSON: (propValue: any) =>
    isJSON(propValue) ? null : 'The value must be a valid JSON string',

  minLength: (propValue: any, min: number) =>
    minLength(propValue, min)
      ? null
      : `The value must be at least ${min} characters long`,

  maxLength: (propValue: any, max: number) =>
    maxLength(propValue, max)
      ? null
      : `The value must be at most ${max} characters long`,

  matches: (propValue: any, pattern: RegExp) =>
    matches(propValue, pattern)
      ? null
      : `The value must match the pattern ${pattern}`,

  isMimeType: (propValue: any) =>
    isMimeType(propValue) ? null : 'The value must be a valid MIME type',

  arrayContains: (propValue: any, values: any[]) =>
    arrayContains(propValue, values)
      ? null
      : `The value must contain all of ${values}`,

  arrayNotContains: (propValue: any, values: any[]) =>
    arrayNotContains(propValue, values)
      ? null
      : `The value must not contain any of ${values}`,

  arrayNotEmpty: (propValue: any) =>
    arrayNotEmpty(propValue) ? null : 'The value must not be empty',

  arrayMinSize: (propValue: any, min: number) =>
    arrayMinSize(propValue, min)
      ? null
      : `The value must contain at least ${min} elements`,

  arrayMaxSize: (propValue: any, max: number) =>
    arrayMaxSize(propValue, max)
      ? null
      : `The value must contain at most ${max} elements`,

  // IsOptional is a special case that always returns null. The logic is handled in the validation service.
  isOptional: (propValue: any, context: any) => null
}
