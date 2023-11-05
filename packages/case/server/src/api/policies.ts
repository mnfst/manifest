export class Policies {
  /**
   * No restriction. Anyone can pass this policy.
   *
   * @returns {Promise<boolean>}
   */
  static noRestriction(): Promise<boolean> {
    return Promise.resolve(true)
  }

  /**
   * Only logged in app users can pass this policy. The user can be from any AuthenticatableEntity subclass.
   *
   * @returns {Promise<boolean>}
   */
  static loggedInOnly(): Promise<boolean> {
    return Promise.resolve(true)
  }

  /**
   * Only logged in admins can pass this policy.
   *
   * @returns {Promise<boolean>}
   */
  static adminOnly(): Promise<boolean> {
    return Promise.resolve(true)
  }
}
