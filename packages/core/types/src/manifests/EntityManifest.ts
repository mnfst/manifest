import { HookManifest } from '../hooks'
import { MiddlewareManifest } from '../middlewares'
import { EntityRule } from '../policies'
import { PolicyManifest } from './PolicyManifest'
import { PropertyManifest } from './PropertyManifest'
import { RelationshipManifest } from './RelationshipManifest'

export interface EntityManifest {
  /**
   * The class name. Used widely on the admin panel. Default: class name.
   */
  className: string

  /**
   * The singular lowercase name of your entity. Used widely on the admin panel. Default: singular lowercase name.
   */
  nameSingular: string

  /**
   * The plural lowercase name of your entity. Used widely on the admin panel. Default: plural lowercase name.
   */
  namePlural: string

  /**
   * The kebab-case slug of the entity that will define API endpoints. Default: plural dasherized name.
   */
  slug: string

  /**
   * The main prop of the entity. Used widely on the admin panel. Default: first string field.
   */
  mainProp: string

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
   * The properties of the entity.
   */
  properties: PropertyManifest[]

  /**
   * The relationships of the entity.
   */
  relationships: RelationshipManifest[]

  /**
   * The policies of the entity.
   */
  policies: Record<EntityRule, PolicyManifest[]>

  hooks?: {
    /**
     * The hooks that are triggered before creating a record.
     */
    beforeCreate?: HookManifest[]

    /**
     * The hooks that are triggered after creating a record.
     */
    afterCreate?: HookManifest[]

    /**
     * The hooks that are triggered before updating a record.
     */
    beforeUpdate?: HookManifest[]

    /**
     * The hooks that are triggered after updating a record.
     */
    afterUpdate?: HookManifest[]

    /**
     * The hooks that are triggered before deleting a record.
     */
    beforeDelete?: HookManifest[]

    /**
     * The hooks that are triggered after deleting a record.
     */
    afterDelete?: HookManifest[]
  }

  middlewares?: {
    /**
     * The hooks that are triggered before creating a record.
     */
    beforeCreate?: MiddlewareManifest[]

    /**
     * The hooks that are triggered after creating a record.
     */
    afterCreate?: MiddlewareManifest[]

    /**
     * The hooks that are triggered before updating a record.
     */
    beforeUpdate?: MiddlewareManifest[]

    /**
     * The hooks that are triggered after updating a record.
     */
    afterUpdate?: MiddlewareManifest[]

    /**
     * The hooks that are triggered before deleting a record.
     */
    beforeDelete?: MiddlewareManifest[]

    /**
     * The hooks that are triggered after deleting a record.
     */
    afterDelete?: MiddlewareManifest[]
  }

  /**
   * Whether the entity is a group (nested entity).
   * Groups entities that serve as reusable components and can only be nested inside other entities and cannot be accessed directly via the API.
   */
  nested?: boolean
}
