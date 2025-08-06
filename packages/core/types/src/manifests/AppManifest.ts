import { EndpointManifest } from '../endpoints'
import { AppSettings } from './AppSettings'
import { EntityManifest } from './EntityManifest'
import { AppEnvironment } from '../common'

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
   * Manifest version.
   */
  manifestVersion?: string

  /**
   * The environment of the app.
   */
  environment?: AppEnvironment

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

  /**
   * The settings of the app.
   */
  settings?: AppSettings
}
