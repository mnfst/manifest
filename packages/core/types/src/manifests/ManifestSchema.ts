/* eslint-disable */
/**
 * This file was automatically generated.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSON Schema file,
 * and run `npm run build` to regenerate this file.
 */

/**
 * A property in your entity. Doc: https://manifest.build/docs/properties
 */
export type PropertySchema =
  | {
      /**
       * The name of the property. Doc: https://manifest.build/docs/properties
       */
      name: string
      /**
       * The type of the property: text, number, link, currency... Default "string". Doc: https://manifest.build/docs/properties#property-types
       */
      type?:
        | 'string'
        | 'text'
        | 'richText'
        | 'number'
        | 'link'
        | 'money'
        | 'date'
        | 'timestamp'
        | 'email'
        | 'boolean'
        | 'relation'
        | 'password'
        | 'choice'
        | 'location'
        | 'file'
        | 'image'
      validation?: ValidationSchema
      /**
       * If the property should be hidden in the API response. Default false. Doc: https://manifest.build/docs/properties#property-params
       */
      hidden?: boolean
      options?: GlobalPropertyOptionsSchema
    }
  | string
/**
 * A relationship between two entities
 */
export type RelationshipSchema =
  | {
      /**
       * The name of the relation
       */
      name?: string
      /**
       * The class name of the entity that the relationship is with
       */
      entity: string
      /**
       * Whether the relationship should be eager loaded. Otherwise, you need to explicitly request the relation in the client SDK or API.
       * Defaults to false.
       */
      eager?: boolean
    }
  | string

/**
 * The 1-file Headless CMS
 */
export interface Manifest {
  /**
   * The name of your app
   */
  name: string
  /**
   * The version of your app
   */
  version?: string
  /**
   * The entities in your app. Doc: https://manifest.build/docs/entities
   */
  entities?: {
    [k: string]: EntitySchema
  }
}
/**
 * An entity in your system: https://manifest.build/docs/entities
 */
export interface EntitySchema {
  /**
   * The class name. Used widely on the admin panel. Default: class name.
   */
  className?: string
  /**
   * The singular lowercase name of your entity. Used widely on the admin panel. Default: singular lowercase name.
   */
  nameSingular?: string
  /**
   * The plural lowercase name of your entity. Used widely on the admin panel. Default: plural lowercase name.
   */
  namePlural?: string
  /**
   * The kebab-case slug of the entity that will define API endpoints. Default: plural dasherized name.
   */
  slug?: string
  /**
   * The main prop of the entity. Used widely on the admin panel. Default: first string field.
   */
  mainProp?: string
  /**
   * The number of entities to seed when running the seed command. Default: 50.
   */
  seedCount?: number
  /**
   * Whether the entity is authenticable. Doc: https://manifest.build/docs/auth
   */
  authenticable?: boolean
  /**
   * Whether the entity is a single type instead of a collection. Doc: https://manifest.build/docs/entities#singles
   */
  single?: boolean
  /**
   * The properties of the entity. Doc: https://manifest.build/docs/entities
   */
  properties?: PropertySchema[]
  /**
   * The ManyToOne relationships of the entity. Doc: https://manifest.build/docs/relations
   */
  belongsTo?: RelationshipSchema[]
  /**
   * The ManyToMany relationships of the entity. Doc: https://manifest.build/docs/relations
   */
  belongsToMany?: RelationshipSchema[]
  policies?: PoliciesSchema
  /**
   * Validation object for the properties. Doc: https://manifest.build/docs/validation
   */
  validation?: {
    '*'?: ValidationSchema1
    [k: string]: unknown
  }
}
/**
 * Validation object for the property.
 */
export interface ValidationSchema {
  /**
   * Checks if value is defined (!== undefined, !== null).
   */
  isDefined?: boolean
  /**
   * Checks if given value is empty (=== null, === undefined) and if so, ignores all the validators on the property.
   */
  isOptional?: boolean
  /**
   * Checks if value equals ("===") comparison.
   */
  equals?: {
    [k: string]: unknown
  }
  /**
   * Checks if value not equal ("!==") comparison.
   */
  notEquals?: {
    [k: string]: unknown
  }
  /**
   * Indicates whether the property can be empty.
   */
  isEmpty?: boolean
  /**
   * Indicates whether the property must not be empty.
   */
  isNotEmpty?: boolean
  /**
   * Indicates whether the property must not be empty.
   */
  required?: boolean
  /**
   * Checks if value is in an array of allowed values.
   */
  isIn?: unknown[]
  /**
   * Checks if value not in an array of disallowed values.
   */
  isNotIn?: unknown[]
  /**
   * The minimum value or length allowed for the property.
   */
  min?: number
  /**
   * The maximum value or length allowed for the property.
   */
  max?: number
  /**
   * Checks if string contains the seed.
   */
  contains?: string
  /**
   * Checks if string does not contain the seed.
   */
  notContains?: string
  /**
   * Checks if the string contains only letters (a-zA-Z).
   */
  isAlpha?: boolean
  /**
   * Checks if the string contains only letters and numbers.
   */
  isAlphanumeric?: boolean
  /**
   * Checks if the string contains ASCII chars only.
   */
  isAscii?: boolean
  /**
   * Checks if the string is an email.
   */
  isEmail?: boolean
  /**
   * Checks if the string is valid JSON.
   */
  isJSON?: boolean
  /**
   * Checks if the string's length is not less than given number.
   */
  minLength?: number
  /**
   * Checks if the string's length is not more than given number.
   */
  maxLength?: number
  /**
   * Checks if string matches the pattern.
   */
  matches?: string
}
/**
 * Global options applicable to all property types.
 */
export interface GlobalPropertyOptionsSchema {
  [k: string]: unknown
}
/**
 * The policies of the entity. Doc: https://manifest.build/docs/policies
 */
export interface PoliciesSchema {
  create?: PolicySchema[]
  read?: PolicySchema[]
  update?: PolicySchema[]
  delete?: PolicySchema[]
  signup?: PolicySchema[]
}
/**
 * The policies of the entity. Doc: https://manifest.build/docs/policies
 */
export interface PolicySchema {
  access: 'public' | 'restricted' | 'forbidden' | 'admin' | '🌐' | '🚫' | '🔒' | '️👨🏻‍💻'
  allow?: string | string[]
}
/**
 * Validation for the property. Doc: https://manifest.build/docs/validation
 */
export interface ValidationSchema1 {
  /**
   * Checks if value is defined (!== undefined, !== null).
   */
  isDefined?: boolean
  /**
   * Checks if given value is empty (=== null, === undefined) and if so, ignores all the validators on the property.
   */
  isOptional?: boolean
  /**
   * Checks if value equals ("===") comparison.
   */
  equals?: {
    [k: string]: unknown
  }
  /**
   * Checks if value not equal ("!==") comparison.
   */
  notEquals?: {
    [k: string]: unknown
  }
  /**
   * Indicates whether the property can be empty.
   */
  isEmpty?: boolean
  /**
   * Indicates whether the property must not be empty.
   */
  isNotEmpty?: boolean
  /**
   * Indicates whether the property must not be empty.
   */
  required?: boolean
  /**
   * Checks if value is in an array of allowed values.
   */
  isIn?: unknown[]
  /**
   * Checks if value not in an array of disallowed values.
   */
  isNotIn?: unknown[]
  /**
   * The minimum value or length allowed for the property.
   */
  min?: number
  /**
   * The maximum value or length allowed for the property.
   */
  max?: number
  /**
   * Checks if string contains the seed.
   */
  contains?: string
  /**
   * Checks if string does not contain the seed.
   */
  notContains?: string
  /**
   * Checks if the string contains only letters (a-zA-Z).
   */
  isAlpha?: boolean
  /**
   * Checks if the string contains only letters and numbers.
   */
  isAlphanumeric?: boolean
  /**
   * Checks if the string contains ASCII chars only.
   */
  isAscii?: boolean
  /**
   * Checks if the string is an email.
   */
  isEmail?: boolean
  /**
   * Checks if the string is valid JSON.
   */
  isJSON?: boolean
  /**
   * Checks if the string's length is not less than given number.
   */
  minLength?: number
  /**
   * Checks if the string's length is not more than given number.
   */
  maxLength?: number
  /**
   * Checks if string matches the pattern.
   */
  matches?: string
}
