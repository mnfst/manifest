import { AuthenticableEntity } from './AuthenticableEntity'

export interface AdminEntity extends AuthenticableEntity {
  /**
   * Whether the admin has access to the backend builder of the admin panel.
   */
  hasBackendBuilderAccess: boolean

  /**
   * Whether the admin has access to the content manager of the admin panel.
   */
  hasContentManagerAccess: boolean

  /**
   * Whether the admin has access to the API documentation of the admin panel.
   */
  hasApiDocsAccess: boolean
}
