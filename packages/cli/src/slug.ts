import { CliError } from './errors';

/**
 * Byte-for-byte mirror of the backend's slugify (common/utils/slugify.ts):
 * trim → lowercase → spaces/underscores to hyphens → remove invalid chars
 * → collapse consecutive hyphens → strip leading/trailing hyphens.
 *
 * Agents are stored under their slug (create slugifies server-side), so the
 * CLI normalizes every agent-name input the same way — `get John` and
 * `get john` are the same agent. The rules are frozen: changing them would
 * orphan every existing agent, so this copy cannot silently drift.
 */
export function slugifyAgentName(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new CliError(
      'invalid_agent_name',
      `"${input}" does not resolve to a valid agent name`,
      'Agent names use letters, numbers, spaces, dashes, and underscores',
    );
  }
  return slug;
}
