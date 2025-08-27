import { AuthenticableEntity } from './AuthenticableEntity'

export interface AdminEntity extends AuthenticableEntity {
  /**
   * Whether the admin has access to the developer panel of the admin panel.
   */
  hasDeveloperPanelAccess: boolean
}
