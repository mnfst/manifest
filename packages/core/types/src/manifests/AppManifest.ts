import { EntityManifest } from './EntityManifest'
import { AppManifestSchema } from './ManifestSchema'

export interface AppManifest extends AppManifestSchema {
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
