import { PropType } from '../crud'
import { ValidationManifest } from './ValidationManifest'

export type PropertyManifest = {
  /**
   * The name of the property.
   */
  name: string

  /**
   * The property type.
   */
  type: PropType

  /**
   * The property is hidden.
   *
   * @default false
   */
  hidden?: boolean

  /**
   * The property options.
   */
  options?: Record<string, unknown>

  /**
   * Validation rules for the property.
   */
  validation?: ValidationManifest

  /**
   * Default value for the property.
   */
  default?: string | number | boolean | Record<string, unknown> | Array<unknown>
}
