import { EntityManifestSchema } from '../manifest-types'
import { PropertyManifest } from './property-manifest.type'
import { RelationshipManifest } from './relationship-manifest.type'

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
