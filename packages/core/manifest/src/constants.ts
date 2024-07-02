// Default values.
export const DEFAULT_PORT = 1111
export const DEFAULT_RESULTS_PER_PAGE = 20
export const DEFAULT_ADMIN_CREDENTIALS = {
  email: 'admin@manifest.build',
  password: 'admin'
}

// Reserved words that are not considered as filters.
export const QUERY_PARAMS_RESERVED_WORDS = [
  'page',
  'perPage',
  'order',
  'orderBy',
  'relations'
]
