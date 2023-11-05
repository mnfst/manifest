import { Admin } from '../core-entities/admin.entity'
import { AuthenticableEntity } from '../core-entities/authenticable-entity'

export class Policies {
  /**
   * No restriction. Anyone can pass this policy.
   *
   * @returns {boolean}
   */
  static noRestriction(): boolean {
    return true
  }

  /**
   * Only logged in app users can pass this policy. The user can be from any AuthenticableEntity subclass.
   *
   * @returns {boolean}
   */
  static loggedInOnly(user: AuthenticableEntity): boolean {
    return !!user
  }

  /**
   * Only logged in admins can pass this policy.
   *
   * @returns {boolean}
   */
  static adminOnly(user: AuthenticableEntity): boolean {
    return user && user instanceof Admin
  }
}
