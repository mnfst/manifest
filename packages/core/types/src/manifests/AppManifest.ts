import { EntityManifest } from './EntityManifest'
import { Manifest } from './ManifestSchema'

export interface AppManifest extends Manifest {
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
}
