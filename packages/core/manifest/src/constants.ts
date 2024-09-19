import { EntityManifest, PropType, PropertyManifest } from '@repo/types'

// Default values.
export const DEFAULT_PORT = 1111
export const DEFAULT_RESULTS_PER_PAGE = 20

// Seeder.
export const DEFAULT_SEED_COUNT: number = 50
export const DEFAULT_MAX_MANY_TO_MANY_RELATIONS: number = 5

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
  nameSingular: 'admin',
  namePlural: 'admins',
  properties: [],
  relationships: [],
  hasMany: [],
  policies: {
    create: [{ access: 'admin' }],
    read: [{ access: 'admin' }],
    update: [{ access: 'admin' }],
    delete: [{ access: 'admin' }],
    signup: [{ access: 'forbidden' }]
  }
}

export const AUTHENTICABLE_PROPS: PropertyManifest[] = [
  {
    name: 'email',
    type: PropType.Email,
    hidden: true,
    validation: { isNotEmpty: true }
  },
  {
    name: 'password',
    type: PropType.Password,
    hidden: true,
    validation: { isNotEmpty: true }
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
