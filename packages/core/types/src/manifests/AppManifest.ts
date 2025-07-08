import { EndpointManifest } from '../endpoints'
import { AppSettings } from './AppSettings'
import { EntityManifest } from './EntityManifest'
import { GroupManifest } from './GroupManifest'

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
   * Whether the app is in production.
   */
  production?: boolean

  /**
   * The entities of the app.
   */
  entities?: {
    [k: string]: EntityManifest
  }

  /**
   * Groups of reusable properties to be used in entities.
   */
  groups?: {
    [k: string]: GroupManifest
  }

  /**
   * The endpoints of the app.
   */
  endpoints?: EndpointManifest[]

  /**
   * The settings of the app.
   */
  settings?: AppSettings
}
