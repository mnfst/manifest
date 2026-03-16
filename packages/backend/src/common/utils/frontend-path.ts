import { join } from 'path';
import { existsSync } from 'fs';

function hasIndex(dir: string): boolean {
  return existsSync(join(dir, 'index.html'));
}

/**
 * Resolves the frontend dist directory across both monorepo and
 * embedded npm package layouts. Returns `null` if no valid directory found.
 */
export function resolveFrontendDir(): string | null {
  const envDir = process.env['MANIFEST_FRONTEND_DIR'];
  if (envDir && hasIndex(envDir)) return envDir;

  // Monorepo: dist/common/utils/ → ../../../../frontend/dist
  const monorepo = join(__dirname, '..', '..', '..', '..', 'frontend', 'dist');
  if (hasIndex(monorepo)) return monorepo;

  // Embedded npm package: dist/backend/common/utils/ → ../../../../public
  const embedded = join(__dirname, '..', '..', '..', '..', 'public');
  if (hasIndex(embedded)) return embedded;

  return null;
}
