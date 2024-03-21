import { PropType } from '@casejs/types'

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
}
