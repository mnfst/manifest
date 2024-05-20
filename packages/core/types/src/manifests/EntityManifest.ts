import { EntityManifestSchema } from './ManifestSchema'
import { PropertyManifest } from './PropertyManifest'
import { RelationshipManifest } from './RelationshipManifest'

export interface EntityManifest extends EntityManifestSchema {
  /**
   * The properties of the entity.
   */
  properties: PropertyManifest[]

  /**
   * The belongsTo relationships of the entity.
   */
  belongsTo: RelationshipManifest[]
}
