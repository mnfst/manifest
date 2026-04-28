import { ScorerMessage, ScorerTool } from './types';
import { DEFAULT_CONFIG } from './config';
import { KeywordTrie, TrieMatch } from './keyword-trie';
import { extractUserTexts } from './text-extractor';
import { detectSpecificity, SpecificityResult } from './specificity-detector';
import type { SpecificityCategory } from 'manifest-shared';

let defaultTrie: KeywordTrie | null = null;

function getDefaultTrie(): KeywordTrie {
  if (!defaultTrie) {
    const dims = DEFAULT_CONFIG.dimensions
      .filter((d) => d.keywords && d.keywords.length > 0)
      .map((d) => ({ name: d.name, keywords: d.keywords! }));
    defaultTrie = new KeywordTrie(dims);
  }
  return defaultTrie;
}

/**
 * Scan messages for specificity detection without running full complexity scoring.
 * Uses only the LAST user message — the latest intent is what matters for
 * task-type routing, not the full conversation history.
 *
 * `recentCategories` (newest first) lets the detector bias toward a sticky
 * session mode when recent classifications all agree — see discussion #1613
 * where a 2-hour coding session got individual turns flipped to web_browsing
 * by isolated web-dev vocabulary.
 */
export function scanMessages(
  messages: ScorerMessage[],
  tools?: ScorerTool[],
  headerOverride?: string,
  recentCategories?: readonly SpecificityCategory[],
  categoryPenalties?: ReadonlyMap<SpecificityCategory, number>,
): SpecificityResult | null {
  if (!messages || messages.length === 0) return null;

  const extracted = extractUserTexts(messages);
  if (extracted.length === 0) return null;

  const lastUserText = extracted[extracted.length - 1].text;
  if (lastUserText.length === 0) return null;

  const trie = getDefaultTrie();
  const allMatches: TrieMatch[] = trie.scan(lastUserText);

  return detectSpecificity(
    allMatches,
    tools,
    headerOverride,
    undefined,
    lastUserText,
    recentCategories,
    categoryPenalties,
  );
}
