import { AppManifestSchema } from '../manifest-types'
import { EntityManifest } from './entity-manifest.interface'

export interface AppManifest extends AppManifestSchema {
  /**
   * The entities of the app.
   */
  entities?: {
    [k: string]: EntityManifest
  }
}
