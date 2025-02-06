import { EndpointManifest } from '../endpoints'
import { EntityManifest } from './EntityManifest'

export interface AppManifest {
  /**
   * The name of the app.
   */
  name: string

  /**
   * The version of the app.
   */
  version?: string

  /**
   * The entities of the app.
   */
  entities?: {
    [k: string]: EntityManifest
  }

  /**
   * The endpoints of the app.
   */
  endpoints?: EndpointManifest[]
}
