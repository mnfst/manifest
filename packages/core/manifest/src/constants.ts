import {
  EntityManifest,
  PropType,
  PropertyManifest,
  ImageSizesObject
} from '@repo/types'

// Default values.
export const DEFAULT_PORT: number = 1111
export const DEFAULT_RESULTS_PER_PAGE: number = 20

// Seeder.
export const DEFAULT_SEED_COUNT: number = 50
export const DEFAULT_MAX_MANY_TO_MANY_RELATIONS: number = 5
export const DUMMY_FILE_NAME: string = 'dummy-invoice.pdf'
export const DUMMY_IMAGE_NAME: string = 'dummy-image.jpg'
export const DEFAULT_TOKEN_SECRET_KEY: string = 'REPLACE_ME'

// Uploads.
export const STORAGE_PATH: string = 'public/storage'
export const DEFAULT_IMAGE_SIZES: ImageSizesObject = {
  thumbnail: {
    width: 80,
    height: 80
  },
  medium: {
    width: 160,
    height: 160
  }
}

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
  belongsToMany: [],
  policies: {
    create: [{ access: 'admin' }],
    read: [{ access: 'admin' }],
    update: [{ access: 'admin' }],
    delete: [{ access: 'admin' }],
    signup: [{ access: 'forbidden' }]
  },
  hooks: {
    beforeCreate: [],
    afterCreate: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDelete: [],
    afterDelete: []
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
