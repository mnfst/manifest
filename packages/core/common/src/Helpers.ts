// src/index.ts
import { ImageSize, RelationshipManifest } from '@repo/types'

/**
 * Get record key by its value.
 *
 * @param record
 * @param value
 * @returns key
 */
export function getRecordKeyByValue<
  T extends Record<string, string>,
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
 * Camelize a string or an array of strings.
 *
 * @param str The string or array of strings to camelize.
 *
 * @returns The camelized string.
 */
export function camelize(str: string | string[]): string {
  const combined = Array.isArray(str) ? str.join('_') : str

  return lowerCaseFirstLetter(
    (combined || '')
      .split('_')
      .map((word, index) =>
        index === 0 ? word : word[0].toUpperCase() + word.slice(1)
      )
      .join('')
  )
}

/**
 * Kebabize a string.
 *
 * @param str The string to kebabize.
 *
 * @returns The kebabized string.
 */
export function kebabize(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

/**
 * Lowercase the first letter of a string.
 *
 * @param str The string to lowercase the first letter of.
 *
 * @returns The string with the first letter lowercased.
 */
export function lowerCaseFirstLetter(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

/**
 * Uppercase the first letter of a string.
 *
 * @param str The string to uppercase the first letter of.
 *
 * @returns The string with the first letter in uppercase.
 */
export function upperCaseFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get a random integer while excluding some values.
 */
export function getRandomIntExcluding({
  min,
  max,
  exclude
}: {
  min: number
  max: number
  exclude?: number[]
}): number {
  const randomInt = Math.floor(Math.random() * (max - min + 1)) + min
  return exclude?.length && exclude.includes(randomInt)
    ? getRandomIntExcluding({ min, max, exclude })
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
  if (relationship.nested) {
    // Nested relationships are passed as objects, not as references.
    return relationship.name
  }

  if (relationship?.type === 'many-to-one') {
    return relationship.name + 'Id'
  } else if (relationship?.type === 'many-to-many') {
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
    return [parseInt(value, 10)]
  } else if (typeof value === 'undefined' || value === null) {
    return []
  }

  return value.map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
}

/**
 * Get the smallest size from an array of ImageSize based on the width.
 *
 * @param imageSizes The array of ImageSize.
 *
 * @returns The smallest image size.
 */
export function getSmallestImageSize(
  imageSizes: ImageSize[]
): ImageSize | undefined {
  return imageSizes.reduce(
    (smallestSize: ImageSize | undefined, currentSize: ImageSize) => {
      if (!smallestSize) return currentSize
      return currentSize.width < smallestSize.width ? currentSize : smallestSize
    },
    undefined
  )
}

export function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64)
  const byteArrays: Uint8Array[] = []

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512)
    const byteNumbers = new Array(slice.length)

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  return new Blob(byteArrays, { type: contentType })
}
