// src/index.ts
import { RelationshipManifest } from '@repo/types'

/**
 * Get record key by its value.
 *
 * @param record
 * @param value
 * @returns key
 */
export function getRecordKeyByValue<
  T extends Record<string, any>,
  V extends T[keyof T]
>(record: T, value: V): string | undefined {
  for (const [key, val] of Object.entries(record)) {
    if (val === value) {
      return key
    }
  }
  return undefined
}

/**
 * Merge 2 strings using camel case.
 */
export function camelCaseTwoStrings(str1: string, str2: string): string {
  const combined = (str1 + ' ' + str2).toLowerCase().split(' ')
  return combined
    .map((word, index) =>
      index === 0 ? word : word[0].toUpperCase() + word.slice(1)
    )
    .join('')
}

/**
 * Get a random integer while excluding some values.
 */
export function getRandomIntExcluding(
  min: number,
  max: number,
  exclude?: number[]
): number {
  const randomInt = Math.floor(Math.random() * (max - min + 1)) + min
  return exclude?.length && exclude.includes(randomInt)
    ? getRandomIntExcluding(min, max, exclude)
    : randomInt
}

/**
 * Gets the DTO property name from a relationship manifest when passing one or several ids as value. Ex: "tags" -> "tagIds", "author" -> "authorId".
 *
 * @param relationship The relationship manifest.
 *
 * @returns The property name.
 */
export function getDtoPropertyNameFromRelationship(
  relationship: RelationshipManifest
): string {
  if (relationship.type === 'many-to-one') {
    return relationship.name + 'Id'
  } else if (relationship.type === 'many-to-many') {
    return relationship.name.endsWith('s')
      ? relationship.name.slice(0, -1) + 'Ids'
      : relationship.name + 'Id'
  } else {
    throw new Error('Unknown relationship')
  }
}

/**
 * Gets the relationship name from a DTO property name when passing one or several ids as value. Ex: "tagIds" -> "tags", "authorId" -> "author".
 *
 * @param propertyName The DTO property name.
 *
 * @returns The relationship name.
 */
export function getRelationshipNameFromDtoPropertyName(
  propertyName: string
): string {
  if (propertyName.endsWith('Id')) {
    return propertyName.endsWith('Ids')
      ? propertyName.slice(0, -3) + 's'
      : propertyName.slice(0, -2)
  } else {
    throw new Error('Unknown property name')
  }
}

/**
 * Forces a value to be an array of numbers. Useful for data that come from HTML inputs.
 *
 * @param value The value to force into an array of numbers.
 * @returns An array of numbers.
 */
export function forceNumberArray(
  value: string | number | number[] | string[]
): number[] {
  if (typeof value === 'number') {
    return [value]
  } else if (typeof value === 'string') {
    return [parseInt(value)]
  }
  return value.map((v) => (typeof v === 'string' ? parseInt(v) : v))
}