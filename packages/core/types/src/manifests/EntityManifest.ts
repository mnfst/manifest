import { HookManifest } from '../hooks'
import { EntitySchema } from './ManifestSchema'
import { PolicyManifest } from './PolicyManifest'
import { PropertyManifest } from './PropertyManifest'
import { RelationshipManifest } from './RelationshipManifest'

export interface EntityManifest extends EntitySchema {
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
  policies: {
    /**
     * The create policy of the entity.
     */
    create: PolicyManifest[]
    /**
     * The read policy of the entity.
     */
    read: PolicyManifest[]
    /**
     * The update policy of the entity.
     */
    update: PolicyManifest[]
    /**
     * The delete policy of the entity.
     */
    delete: PolicyManifest[]
    /**
     * The signup policy of the entity.
     */
    signup: PolicyManifest[]
  }

  hooks: {
    /**
     * The hooks that are triggered before creating a record.
     */
    beforeCreate: HookManifest[]

    /**
     * The hooks that are triggered after creating a record.
     */
    afterCreate: HookManifest[]

    /**
     * The hooks that are triggered before updating a record.
     */
    beforeUpdate: HookManifest[]

    /**
     * The hooks that are triggered after updating a record.
     */
    afterUpdate: HookManifest[]

    /**
     * The hooks that are triggered before deleting a record.
     */
    beforeDelete: HookManifest[]

    /**
     * The hooks that are triggered after deleting a record.
     */
    afterDelete: HookManifest[]
  }
}
