import { ValidationSchema } from './ManifestSchema'

export interface ValidationManifest<T = unknown> extends ValidationSchema<T> {
  /**
   * Other properties.
   */
  [key: string]: unknown
}
