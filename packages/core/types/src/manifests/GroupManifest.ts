import { PropertyManifest } from './PropertyManifest'
import { RelationshipManifest } from './RelationshipManifest'

export interface GroupManifest {
  /**
   * The class name. Used widely on the admin panel. Default: class name.
   */
  className: string

  /**
   * The singular lowercase name of your group. Used widely on the admin panel. Default: singular lowercase name.
   */
  nameSingular: string

  /**
   * The properties of the group.
   */
  properties: PropertyManifest[]

  /**
   * The relationships of the group.
   */
  relationships: RelationshipManifest[]
}
