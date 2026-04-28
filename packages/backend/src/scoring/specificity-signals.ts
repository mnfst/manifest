import type { SpecificityCategory } from 'manifest-shared';
import { ScorerTool } from './types';

/**
 * Heuristic signals that sit alongside keyword matches. These fire off
 * structural cues (URLs, code fences, file paths, tool names) rather than a
 * word list, so they catch the context that keywords alone miss.
 */

export interface SignalBoosts {
  boosts: Map<SpecificityCategory, number>;
}

// ── URL detection ──
// Loose match: scheme + host. Intentionally permissive so "https://x.co" fires.
const URL_REGEX = /\bhttps?:\/\/[^\s)"']+/i;
// A bare host like "google.com" without scheme — weaker signal.
const BARE_HOST_REGEX = /\b[a-z0-9][a-z0-9-]*\.(com|org|net|io|dev|app|co|gov|edu|ai)\b/i;

/**
 * URL alone is intentionally not enough to activate web_browsing — a URL
 * inside a coding question ("the api call to https://api.stripe.com fails")
 * should still route to coding. Combined with a browse verb (`visit`,
 * `navigate to`) the total clears the threshold cleanly.
 */
const URL_BOOST = 2;
const BARE_HOST_BOOST = 1;

// ── Code-context negative signals ──
// Fenced code block — anywhere.
const CODE_FENCE_REGEX = /```/;
// Looks like a file path. Covers `./foo`, `/foo` and the named `src/` /
// `packages/` / etc. prefixes. Bare ` / ` (slash between whitespace, like
// "a / b") is intentionally NOT matched — the `\/\w` trailer requires a
// word char right after the slash, so "a / b" does not qualify but
// "/src/foo" or "./foo" still do. The extension alternative requires a
// trailing word boundary so "weather.com" does not spuriously match ".c".
const FILE_PATH_REGEX =
  /(?:^|\s)(?:\.?\/\w|src\/|packages\/|app\/|lib\/|components\/|pages\/|[\w-]+\.(?:ts|tsx|js|jsx|py|go|rs|rb|java|kt|swift|php|cs|cpp|c|h|hpp|sh|sql|yaml|yml|json|toml|md|html|css|scss)\b)/i;
// Stack trace fragments.
const STACK_TRACE_REGEX = /\b(?:TypeError|ReferenceError|SyntaxError|Traceback|at \w+\.\w+\s*\()/;
// Common coding tool names that imply a coding session.
const CODING_TOOL_NAMES = new Set([
  'read',
  'write',
  'edit',
  'bash',
  'grep',
  'glob',
  'str_replace',
  'str_replace_editor',
  'apply_patch',
  'multiedit',
  'notebookedit',
  'create_file',
  'view',
]);

/** Per-signal boost for coding. */
const CODE_FENCE_BOOST = 3;
const FILE_PATH_BOOST = 2;
const STACK_TRACE_BOOST = 3;
const CODING_TOOL_BOOST = 3;

/**
 * Inspect the user text + tool list and emit structural signal boosts.
 *
 * URLs and code fences are the two cleanest disambiguators for the
 * coding-vs-web_browsing question that drove discussion #1613.
 */
export function computeSignalBoosts(text: string, tools?: ScorerTool[]): SignalBoosts {
  const boosts = new Map<SpecificityCategory, number>();
  const add = (cat: SpecificityCategory, v: number) => boosts.set(cat, (boosts.get(cat) ?? 0) + v);

  if (URL_REGEX.test(text)) {
    add('web_browsing', URL_BOOST);
  } else if (BARE_HOST_REGEX.test(text)) {
    add('web_browsing', BARE_HOST_BOOST);
  }

  if (CODE_FENCE_REGEX.test(text)) add('coding', CODE_FENCE_BOOST);
  if (FILE_PATH_REGEX.test(text)) add('coding', FILE_PATH_BOOST);
  if (STACK_TRACE_REGEX.test(text)) add('coding', STACK_TRACE_BOOST);

  if (tools) {
    for (const t of tools) {
      const name = extractToolName(t);
      if (name && CODING_TOOL_NAMES.has(name.toLowerCase())) {
        add('coding', CODING_TOOL_BOOST);
        break;
      }
    }
  }

  return { boosts };
}

function extractToolName(tool: ScorerTool): string | null {
  if (typeof tool.name === 'string') return tool.name;
  const fn = tool.function as { name?: string } | undefined;
  if (fn && typeof fn.name === 'string') return fn.name;
  return null;
}
