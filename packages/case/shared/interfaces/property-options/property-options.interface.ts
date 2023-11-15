/**
 * Common property options. Those options can be used whatever the property type.
 */
export interface PropertyOptions {
  /**
   * Whether or not this property will be used as a filter in list.
   *
   * @default true
   */
  filter?: boolean

  /**
   * Hides this property in the list.
   */
  isHiddenInList?: boolean

  /**
   * Hides this property in the detail view.
   */
  isHiddenInDetail?: boolean
}
