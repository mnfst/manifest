/**
 * Common property options. Those options can be used whatever the property type.
 */
export interface PropertyOptions {
  /**
   * Hides this property in the API response.
   */
  isHidden?: boolean

  /**
   * Hides this property in the list of the Admin panel.
   */
  isHiddenInAdminList?: boolean

  /**
   * Hides this property in create and edit views of the Admin panel.
   */
  isHiddenInAdminCreateEdit?: boolean
}
