import { PolicyManifest } from '../../types/src'

export const TOKEN_KEY = 'manifestToken'
export const ADMIN_CLASS_NAME = 'Admin'

// TODO: Create a shared package for these constants as they also exist in the core package.
export const DEFAULT_ADMIN_CREDENTIALS = {
  email: 'admin@manifest.build',
  password: 'admin'
}

export const EMPTY_MANIFEST_NAME: string = 'empty_manifest'

export const ADMIN_ACCESS_POLICY: PolicyManifest = { access: 'admin' }
export const FORBIDDEN_ACCESS_POLICY: PolicyManifest = { access: 'forbidden' }
