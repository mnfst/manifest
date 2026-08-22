import { SetMetadata } from '@nestjs/common';

/**
 * Marks an admin-surface route as bootstrap-capable: an authenticated OWNER
 * key (scope `owner`) may call it in addition to `ai_admin` keys.
 *
 * Why this exists: on a fresh self-hosted install no `ai_admin` key can exist
 * yet — every admin route demands one, and owner keys were rejected with 403,
 * so there was no way to mint the first admin key (chicken-and-egg). Only
 * routes explicitly marked with this decorator relax the scope; every other
 * `/api/v1/admin` route remains exclusively `ai_admin`.
 */
export const ADMIN_BOOTSTRAP_KEY = 'admin_bootstrap';
export const AdminBootstrap = () => SetMetadata(ADMIN_BOOTSTRAP_KEY, true);
