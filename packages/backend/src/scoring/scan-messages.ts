import { ScorerMessage, ScorerTool } from './types';
import { DEFAULT_CONFIG } from './config';
import { KeywordTrie, TrieMatch } from './keyword-trie';
import { extractUserTexts } from './text-extractor';
import { detectSpecificity, SpecificityResult } from './specificity-detector';

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
 */
export function scanMessages(
  messages: ScorerMessage[],
  tools?: ScorerTool[],
  headerOverride?: string,
): SpecificityResult | null {
  if (!messages || messages.length === 0) return null;

  const extracted = extractUserTexts(messages);
  if (extracted.length === 0) return null;

  const lastUserText = extracted[extracted.length - 1].text;
  if (lastUserText.length === 0) return null;

  const trie = getDefaultTrie();
  const allMatches: TrieMatch[] = trie.scan(lastUserText);

  return detectSpecificity(allMatches, tools, headerOverride);
}
