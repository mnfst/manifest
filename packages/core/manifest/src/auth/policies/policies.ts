import { AccessPolicy, AuthenticableEntity, EntityManifest } from '@mnfst/types'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

export const policies: Record<
  AccessPolicy,
  (
    user: AuthenticableEntity,
    entity: EntityManifest,
    options?: {
      allow?: string[]
    }
  ) => boolean
> = {
  /**
   * Returns whether the user is an admin.
   */
  admin: (user: AuthenticableEntity, entity: EntityManifest) =>
    user && entity.slug === ADMIN_ENTITY_MANIFEST.slug,

  /**
   * Allows access to all users.
   */
  public: (_user: AuthenticableEntity, _entity: EntityManifest) => true,

  /**
   * Forbids access to all users.
   */
  forbidden: (_user: AuthenticableEntity, _entity: EntityManifest) => false,

  /**
   * Returns whether the user is authenticated. If "allow" is provided, it will check if the entity is allowed.
   */
  restricted: (
    user: AuthenticableEntity,
    entity: EntityManifest,
    options: { allow: string[] }
  ) => {
    if (!user) {
      return false
    }

    // Admins have access to restricted content.
    if (policies.admin(user, entity)) {
      return true
    }

    if (options.allow) {
      return options.allow.includes(entity.className)
    }

    return true
  }
}
