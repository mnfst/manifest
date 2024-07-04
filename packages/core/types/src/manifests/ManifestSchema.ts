/* eslint-disable */
/**
 * This file was automatically generated.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSON Schema file,
 * and run `npm run build` to regenerate this file.
 */

/**
 * A property in your entity. Doc: https://manifest.build/docs/properties
 */
export type PropertyManifestSchema =
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
      /**
       * If the property should be hidden in the API response. Default false. Doc: https://manifest.build/docs/properties#property-params
       */
      hidden?: boolean
      options?: GlobalPropertyOptionsSchema &
        (
          | {
              [k: string]: unknown
            }
          | {
              [k: string]: unknown
            }
        )
    }
  | string
/**
 * A relationship between two entities
 */
export type RelationshipManifestSchema =
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
 * A complete backend in a single file
 */
export interface AppManifestSchema {
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
    [k: string]: EntityManifestSchema
  }
}
/**
 * An entity in the system
 */
export interface EntityManifestSchema {
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
   * The properties of the entity. Doc: https://manifest.build/docs/entities
   */
  properties?: PropertyManifestSchema[]
  /**
   * The belongsTo relationships of the entity. Doc: https://manifest.build/docs/relations
   */
  belongsTo?: RelationshipManifestSchema[]
}
/**
 * Global options applicable to all property types.
 */
export interface GlobalPropertyOptionsSchema {
  [k: string]: unknown
}
