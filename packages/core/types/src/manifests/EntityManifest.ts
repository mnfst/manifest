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
   * The belongsTo relationships of the entity.
   */
  belongsTo: RelationshipManifest[]

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
}
