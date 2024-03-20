/* eslint-disable */
/**
 * This file was automatically generated.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSON Schema file,
 * and run `npm run build` to regenerate this file.
 */

/**
 * A property in your entity. Doc: https://docs.case.app/properties
 */
export type PropertyManifest =
  | ({
      [k: string]: unknown
    } & {
      [k: string]: unknown
    })
  | string
/**
 * A relationship between two entities
 */
export type RelationshipManifest =
  | {
      /**
       * The name of the relation
       */
      name?: string
      /**
       * The entity that the relationship is with
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
 * A complete backend in a single file.
 */
export interface AppManifest {
  /**
   * The name of your app
   */
  name: string
  /**
   * The entities in your app. Doc: https://docs.case.app/entities
   */
  entities?: {
    [k: string]: EntityManifest
  }
}
/**
 * An entity in the system
 */
export interface EntityManifest {
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
   * The properties of the entity. Doc: https://docs.case.app/properties
   */
  properties?: PropertyManifest[]
  /**
   * The belongsTo relationships of the entity. Doc: https://docs.case.app/relationships
   */
  belongsTo?: RelationshipManifest[]
}
