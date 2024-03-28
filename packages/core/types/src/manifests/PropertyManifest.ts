import { PropType } from '../crud'

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
}
