import { EntityManifest } from './EntityManifest'
import { AppManifestSchema } from './ManifestSchema'

export interface AppManifest extends AppManifestSchema {
  /**
   * The entities of the app.
   */
  entities?: {
    [k: string]: EntityManifest
  }
}
