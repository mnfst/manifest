import { PropertyManifest } from './PropertyManifest'

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
   * The properties of the entity.
   */
  properties: PropertyManifest[]
}
