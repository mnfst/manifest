import { EntityManifest, PropType } from '@mnfst/types'

export const DEFAULT_SEED_COUNT: number = 50

export const ADMIN_ENTITY_MANIFEST: EntityManifest = {
  className: 'Admin',
  mainProp: 'email',
  properties: [
    {
      name: 'email',
      type: PropType.Email
    },
    {
      name: 'password',
      type: PropType.Password
    }
  ],
  belongsTo: []
}
