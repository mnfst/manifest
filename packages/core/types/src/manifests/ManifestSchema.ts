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
       * The name of the property. Doc: https://manifest.build/docs/entities#properties
       */
      name: string
      /**
       * The optional label of the property that replaces the name in the admin UI if provided. Doc: https://manifest.build/docs/entities#properties
       */
      label?: string
      /**
       * The type of the property: text, number, link, currency... Default "string". Doc: https://manifest.build/docs/entities#property-types
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
        | 'password'
        | 'choice'
        | 'location'
        | 'file'
        | 'image'
        | 'group'
      /**
       * Optional help text to provide additional guidance for the property in the admin UI.
       */
      helpText?: string
      validation?: ValidationSchema
      /**
       * The default value of the property. Doc: https://manifest.build/docs/entities#property-params
       */
      default?:
        | string
        | number
        | boolean
        | {
            [k: string]: unknown
          }
        | unknown[]
      /**
       * If the property should be hidden in the API response. Default false. Doc: https://manifest.build/docs/entities#property-params
       */
      hidden?: boolean
      options?: GlobalPropertyOptionsSchema
    }
  | string
/**
 * A relationship between two entities. Doc: https://manifest.build/docs/entities#relations
 */
export type RelationshipSchema =
  | {
      /**
       * The name of the relation.
       */
      name?: string
      /**
       * The class name of the entity that the relationship is with.
       */
      entity: string
      /**
       * Whether the relationship should be eager loaded. Otherwise, you need to explicitly request the relation in the client SDK or API.
       * Defaults to false.
       */
      eager?: boolean
      /**
       * Optional help text to provide additional guidance for the relationship in the admin UI.
       */
      helpText?: string
    }
  | string

/**
 * 1-file backend to ship fast
 */
export interface Manifest {
  /**
   * The name of your app.
   */
  name: string
  /**
   * The version of your app.
   */
  version?: string
  /**
   * The entities in your app. Doc: https://manifest.build/docs/entities
   */
  entities?: {
    [k: string]: EntitySchema
  }
  /**
   * Groups of reusable properties to be used in entities. Doc: https://manifest.build/docs/entities#groups
   */
  groups?: {
    [k: string]: GroupSchema
  }
  /**
   * The endpoints in your app. Create your own endpoints linking a path and an HTTP method to a handler function. Doc: https://manifest.build/docs/endpoints
   */
  endpoints?: {
    [k: string]: EndpointSchema
  }
  settings?: SettingsSchema
}
/**
 * An entity in your system. Doc: https://manifest.build/docs/entities
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
   * Whether the entity is authenticable. Doc: https://manifest.build/docs/authentication#authenticable-entities
   */
  authenticable?: boolean
  /**
   * Whether the entity is a single type instead of a collection. Doc: https://manifest.build/docs/entities#singles
   */
  single?: boolean
  /**
   * The properties of the entity. Doc: https://manifest.build/docs/entities#properties
   */
  properties?: PropertySchema[]
  /**
   * The ManyToOne relationships of the entity. Doc: https://manifest.build/docs/relations
   */
  belongsTo?: RelationshipSchema[]
  /**
   * The ManyToMany relationships of the entity. Doc: https://manifest.build/docs/entities#relations
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
  hooks?: HooksSchema
  middlewares?: MiddlewaresSchema
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
 * The policies of the entity. Doc: https://manifest.build/docs/access
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
  /**
   * When set to 'self', restricts access to records owned by the authenticated user (requires belongsTo relationship)
   */
  condition?: 'self'
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
/**
 * The hooks related to entity records events. Doc: https://manifest.build/docs/hooks
 */
export interface HooksSchema {
  /**
   * Hooks to run before creating a record. Doc: https://manifest.build/docs/hooks#events
   */
  beforeCreate?: HookSchema[]
  /**
   * Hooks to run after creating a record. Doc: https://manifest.build/docs/hooks#events
   */
  afterCreate?: HookSchema[]
  /**
   * Hooks to run before updating a record. Doc: https://manifest.build/docs/hooks#events
   */
  beforeUpdate?: HookSchema[]
  /**
   * Hooks to run after updating a record. Doc: https://manifest.build/docs/hooks#events
   */
  afterUpdate?: HookSchema[]
  /**
   * Hooks to run before deleting a record. Doc: https://manifest.build/docs/hooks#events
   */
  beforeDelete?: HookSchema[]
  /**
   * Hooks to run after deleting a record. Doc: https://manifest.build/docs/hooks#events
   */
  afterDelete?: HookSchema[]
}
/**
 * A hook related to an event the entity records. Doc: https://manifest.build/docs/hooks
 */
export interface HookSchema {
  /**
   * The URL to send the request to.
   */
  url: string
  /**
   * The HTTP method to use, defaults to POST.
   */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /**
   * The headers to send with the request
   */
  headers?: {
    [k: string]: string
  }
}
/**
 * The middlewares related to entity records events. Doc: https://manifest.build/docs/middlewares
 */
export interface MiddlewaresSchema {
  /**
   * Middlewares to run before creating a record. Doc: https://manifest.build/docs/middlewares#events
   */
  beforeCreate?: MiddlewareSchema[]
  /**
   * Middlewares to run after creating a record. Doc: https://manifest.build/docs/middlewares#events
   */
  afterCreate?: MiddlewareSchema[]
  /**
   * Middlewares to run before updating a record. Doc: https://manifest.build/docs/middlewares#events
   */
  beforeUpdate?: MiddlewareSchema[]
  /**
   * Middlewares to run after updating a record. Doc: https://manifest.build/docs/middlewares#events
   */
  afterUpdate?: MiddlewareSchema[]
  /**
   * Middlewares to run before deleting a record. Doc: https://manifest.build/docs/middlewares#events
   */
  beforeDelete?: MiddlewareSchema[]
  /**
   * Middlewares to run after deleting a record. Doc: https://manifest.build/docs/middlewares#events
   */
  afterDelete?: MiddlewareSchema[]
}
/**
 * A middleware related to an event the entity records. Doc: https://manifest.build/docs/middlewares
 */
export interface MiddlewareSchema {
  /**
   * The name of the handler function for this middleware. Doc: https://manifest.build/docs/middlewares#handlers
   */
  handler: string
}
/**
 * A group of reusable properties to be used in entities. Doc: https://manifest.build/docs/entities#groups
 */
export interface GroupSchema {
  /**
   * The properties of the group. Doc: https://manifest.build/docs/entities#properties
   */
  properties?: PropertySchema[]
  /**
   * Validation object for the properties. Doc: https://manifest.build/docs/validation
   */
  validation?: {
    '*'?: ValidationSchema1
    [k: string]: unknown
  }
}
/**
 * Defines a custom endpoint in Manifest: https://manifest.build/docs/endpoints
 */
export interface EndpointSchema {
  /**
   * The URL path of the endpoint. Must start with a '/'.
   */
  path: string
  /**
   * The HTTP method for the endpoint.
   */
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /**
   * The name of the handler function for this endpoint. Doc: https://manifest.build/docs/endpoints
   */
  handler: string
  /**
   * An optional endpoint description. Doc: https://manifest.build/docs/endpoints
   */
  description?: string
  /**
   * An optional array of policies applied to the endpoint.
   */
  policies?: PolicySchema1[]
}
/**
 * The policies of the entity. Doc: https://manifest.build/docs/policies
 */
export interface PolicySchema1 {
  access: 'public' | 'restricted' | 'forbidden' | 'admin' | '🌐' | '🚫' | '🔒' | '️👨🏻‍💻'
  allow?: string | string[]
  /**
   * When set to 'self', restricts access to records owned by the authenticated user (requires belongsTo relationship)
   */
  condition?: 'self'
}
/**
 * Application settings configuration
 */
export interface SettingsSchema {
  /**
   * Rate limiting configuration for your app. Doc: https://manifest.build/docs/security#rate-limiting
   */
  rateLimits?: {
    /**
     * Name identifier for the rate limit rule
     */
    name?: string
    /**
     * Maximum number of requests allowed
     */
    limit: number
    /**
     * Time window in milliseconds for the rate limit
     */
    ttl: number
  }[]
}
