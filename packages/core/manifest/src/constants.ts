import {
  EntityManifest,
  PropType,
  PropertyManifest,
  ImageSizesObject,
  PolicyManifest
} from '@repo/types'

// Paths.
export const STORAGE_PATH: string = 'storage'
export const API_PATH: string = 'api'
export const COLLECTIONS_PATH: string = 'collections'
export const SINGLES_PATH: string = 'singles'
export const ENDPOINTS_PATH: string = 'endpoints'
export const GENERATED_FOLDER_PATH: string = '.manifest'

// Default values.
export const DEFAULT_PORT: number = 1111
export const DEFAULT_RESULTS_PER_PAGE: number = 20
export const EMPTY_MANIFEST_NAME: string = 'empty_manifest'

// Security.
export const SALT_ROUNDS: number = 10

// Seeder.
export const DEFAULT_SEED_COUNT: number = 50
export const DEFAULT_MAX_MANY_TO_MANY_RELATIONS: number = 5
export const DUMMY_FILE_NAME: string = 'dummy-invoice.pdf'
export const DUMMY_IMAGE_NAME: string = 'dummy-image.jpg'
export const DEFAULT_TOKEN_SECRET_KEY: string = 'REPLACE_ME'

// Uploads.
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

export const AUTHENTICABLE_PROPS: PropertyManifest[] = [
  {
    name: 'email',
    label: 'email',
    type: PropType.Email,
    hidden: true,
    validation: { isNotEmpty: true }
  },
  {
    name: 'password',
    label: 'password',
    type: PropType.Password,
    hidden: true,
    validation: { isNotEmpty: true }
  }
]

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
  properties: AUTHENTICABLE_PROPS.concat(
    {
      name: 'hasBackendBuilderAccess',
      label: 'Backend Builder access',
      helpText:
        'Check this box to grant access to the backend builder to manage DB structure and settings',
      type: PropType.Boolean,
      default: false
    },
    {
      name: 'hasContentManagerAccess',
      label: 'Content Manager access',
      helpText:
        'Check this box to grant access to the content manager to manage content',
      type: PropType.Boolean,
      default: false
    },
    {
      name: 'hasApiDocsAccess',
      label: 'API Docs access',
      helpText: 'Check this box to grant access to the API documentation',
      type: PropType.Boolean,
      default: false
    }
  ),
  relationships: [],
  policies: {
    create: [{ access: 'admin' }],
    read: [{ access: 'admin' }],
    update: [{ access: 'admin' }],
    delete: [{ access: 'admin' }],
    signup: [{ access: 'forbidden' }]
  }
}

// Reserved words that are not considered as filters.
export const QUERY_PARAMS_RESERVED_WORDS = [
  'page',
  'perPage',
  'order',
  'orderBy',
  'relations'
]

// Policies.
export const ADMIN_ACCESS_POLICY: PolicyManifest = { access: 'admin' }
export const PUBLIC_ACCESS_POLICY: PolicyManifest = { access: 'public' }
export const FORBIDDEN_ACCESS_POLICY: PolicyManifest = { access: 'forbidden' }
