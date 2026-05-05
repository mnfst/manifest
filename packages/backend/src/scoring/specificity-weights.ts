import type { SpecificityCategory } from 'manifest-shared';

/**
 * Per-keyword weights used by specificity detection. Keywords not in this map
 * default to 1.0. Strong anchor phrases (`navigate to`, `scrape`) weigh more
 * than weak generics (`website`) so that a single strong phrase can activate
 * a category but a single generic cannot.
 *
 * Tune these when discussion #1613-style misrouting re-appears on new vocab.
 */
export const KEYWORD_WEIGHTS: Record<string, number> = {
  // web_browsing — unambiguous anchors
  'navigate to': 4,
  'browse to': 4,
  scrape: 4,
  crawl: 4,
  'open url': 4,
  'fetch url': 4,
  'fetch the url': 4,
  'take a screenshot': 4,
  'web search': 4,
  'bookmark this': 4,
  'fill out the form': 4,

  // web_browsing — strong browse verbs
  browse: 3,
  visit: 3,
  navigate: 3,
  'go to': 3,
  'open this': 3,
  'search for': 3,
  'search on': 3,
  'fill out': 3,
  'look up': 3,
  'scroll to': 3,
  'scroll down': 3,
  'scroll up': 3,

  // web_browsing — strong qualified context phrases (only appear on browse
  // prompts — realistic coding prompts use "the site/page/url" not "this")
  'this website': 3,
  'this webpage': 3,
  'this site': 3,
  'this url': 3,
  'on this page': 3,
  'on this site': 3,
  'on this website': 3,
  'from this page': 3,

  // web_browsing — medium context phrases
  'this page': 3,
  'this domain': 2,
  'open the url': 2,
  'click the': 2,
  'click on': 2,
  'click on the': 2,
  'screenshot of': 2,
  webpage: 2,

  // web_browsing — weaker nouns (need another signal to cross threshold)
  website: 1.5,
  'web page': 1.5,
};

/**
 * Minimum weighted score required to activate each category.
 *
 * web_browsing is intentionally high (matches the strong-anchor weight of 3):
 * a single generic match like `website` (1.5) or `click the` (2) must combine
 * with additional signal before it flips routing. Other categories stay at 1.0
 * so prior positive-detection coverage (80%+ on 100 prompts per category)
 * remains intact — they never had the false-positive blast radius that
 * web_browsing did. The `coding` false positive in #1767 was fixed at the
 * signal source (trimming generic tool names, requiring a substantive code
 * fence body, peeling agent metadata envelopes) rather than by raising this
 * threshold — which would have hurt detection accuracy on real coding
 * prompts that only carry a single technical keyword.
 */
export const ACTIVATION_THRESHOLDS: Record<SpecificityCategory, number> = {
  coding: 1.0,
  web_browsing: 3.0,
  data_analysis: 1.0,
  image_generation: 1.0,
  video_generation: 1.0,
  social_media: 1.0,
  email_management: 1.0,
  calendar_management: 1.0,
  trading: 1.0,
};

/** Weight a single keyword match. Unknown keywords fall back to 1.0. */
export function weightFor(keyword: string): number {
  return KEYWORD_WEIGHTS[keyword] ?? 1;
}
