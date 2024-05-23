import { BaseEntity } from './BaseEntity'

/**
 * The AuthenticableEntity interface is a BaseEntity with an unique email and a password (used for admins, users and everyone that needs to be authenticated).
 *
 */
export interface AuthenticableEntity extends BaseEntity {
  /**
   * The entity's unique email. It is used for authentication.
   *
   * */
  email: string

  /**
   * The entity's password. It is used for authentication.
   *
   * */
  password: string
}
