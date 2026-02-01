/**
 * Default admin user credentials for development/POC.
 * Used by seed service and can be pre-filled on login page.
 */
export const DEFAULT_ADMIN_USER = {
  email: 'admin@manifest.build',
  password: 'manifest',
  firstName: 'Admin',
  lastName: 'User',
  name: 'Admin User',
} as const;
