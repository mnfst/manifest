import { AccessPolicy } from '@mnfst/types'

export const policies: Record<
  AccessPolicy,
  (user: any, entity: any) => boolean
> = {
  // TODO Implement policies
  public: (user, entity) => true,

  restricted: (user, entity) => !!user,

  forbidden: (user, entity) => false,

  admin: (user, entity) => user?.role === 'admin'
}
