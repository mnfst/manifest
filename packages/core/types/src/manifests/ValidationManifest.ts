import { ValidationSchema } from './ManifestSchema'

export interface ValidationManifest extends ValidationSchema {
  /**
   * Other properties.
   */
  [key: string]: unknown
}
