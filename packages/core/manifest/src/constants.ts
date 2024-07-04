import { EntityManifest, PropType, PropertyManifest } from '@mnfst/types'

// Default values.
export const DEFAULT_PORT = 1111
export const DEFAULT_RESULTS_PER_PAGE = 20
export const DEFAULT_SEED_COUNT: number = 50

// Admin entity.
export const DEFAULT_ADMIN_CREDENTIALS = {
  email: 'admin@manifest.build',
  password: 'admin'
}
export const ADMIN_ENTITY_MANIFEST: EntityManifest = {
  className: 'Admin',
  mainProp: 'email',
  slug: 'admins',
  authenticable: true,
  properties: [],
  belongsTo: []
}

export const AUTHENTICABLE_PROPS: PropertyManifest[] = [
  {
    name: 'email',
    type: PropType.Email,
    hidden: true
  },
  {
    name: 'password',
    type: PropType.Password,
    hidden: true
  }
]

// Reserved words that are not considered as filters.
export const QUERY_PARAMS_RESERVED_WORDS = [
  'page',
  'perPage',
  'order',
  'orderBy',
  'relations'
]
