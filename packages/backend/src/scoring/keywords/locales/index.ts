/**
 * Multilingual keyword locale registry.
 *
 * Each locale exports keyword sets that mirror the structure of the base
 * English files. The scorer merges the appropriate locale set into the base
 * English set before running the trie scan — English behavior is unchanged
 * when no locale match is found.
 *
 * Language detection is performed by `franc-min` (< 1ms, fully local,
 * zero external API calls). Install with:
 *   npm install franc-min
 *
 * To force a specific locale without auto-detection, set:
 *   MANIFEST_LOCALE=pt-BR
 */

import { COMPLEXITY_KEYWORDS_PT_BR } from './pt-BR/complexity';
import { CALENDAR_MANAGEMENT_KEYWORDS_PT_BR } from './pt-BR/calendar-management';
import { DATA_ANALYSIS_KEYWORDS_PT_BR } from './pt-BR/data-analysis';
import { EMAIL_MANAGEMENT_KEYWORDS_PT_BR } from './pt-BR/email-management';
import { IMAGE_GENERATION_KEYWORDS_PT_BR } from './pt-BR/image-generation';
import { SOCIAL_MEDIA_KEYWORDS_PT_BR } from './pt-BR/social-media';
import { TRADING_KEYWORDS_PT_BR } from './pt-BR/trading';
import { VIDEO_GENERATION_KEYWORDS_PT_BR } from './pt-BR/video-generation';
import { WEB_BROWSING_KEYWORDS_PT_BR } from './pt-BR/web-browsing';

export interface LocaleKeywords {
  complexity: Record<string, string[]>;
  calendarManagement: string[];
  dataAnalysis: string[];
  emailManagement: string[];
  imageGeneration: string[];
  socialMedia: string[];
  trading: string[];
  videoGeneration: string[];
  webBrowsing: string[];
}

/**
 * Map from BCP-47 language tag (as returned by franc) to locale keyword sets.
 * Add new locales here as they are implemented.
 */
export const LOCALE_KEYWORDS: Record<string, LocaleKeywords> = {
  'pt': {
    complexity: COMPLEXITY_KEYWORDS_PT_BR,
    calendarManagement: CALENDAR_MANAGEMENT_KEYWORDS_PT_BR,
    dataAnalysis: DATA_ANALYSIS_KEYWORDS_PT_BR,
    emailManagement: EMAIL_MANAGEMENT_KEYWORDS_PT_BR,
    imageGeneration: IMAGE_GENERATION_KEYWORDS_PT_BR,
    socialMedia: SOCIAL_MEDIA_KEYWORDS_PT_BR,
    trading: TRADING_KEYWORDS_PT_BR,
    videoGeneration: VIDEO_GENERATION_KEYWORDS_PT_BR,
    webBrowsing: WEB_BROWSING_KEYWORDS_PT_BR,
  },
  'pt-BR': {
    complexity: COMPLEXITY_KEYWORDS_PT_BR,
    calendarManagement: CALENDAR_MANAGEMENT_KEYWORDS_PT_BR,
    dataAnalysis: DATA_ANALYSIS_KEYWORDS_PT_BR,
    emailManagement: EMAIL_MANAGEMENT_KEYWORDS_PT_BR,
    imageGeneration: IMAGE_GENERATION_KEYWORDS_PT_BR,
    socialMedia: SOCIAL_MEDIA_KEYWORDS_PT_BR,
    trading: TRADING_KEYWORDS_PT_BR,
    videoGeneration: VIDEO_GENERATION_KEYWORDS_PT_BR,
    webBrowsing: WEB_BROWSING_KEYWORDS_PT_BR,
  },
  // Future locales:
  // 'es': { ... }
  // 'fr': { ... }
  // 'de': { ... }
};

/**
 * Detects the language of a text string.
 * Returns the BCP-47 language code (e.g. 'pt', 'en', 'es') or null if
 * detection confidence is too low (< 0.5).
 *
 * Uses franc-min for detection — install with: npm install franc-min
 * Falls back to MANIFEST_LOCALE env var if franc is unavailable.
 */
export function detectLanguage(text: string): string | null {
  // 1. Check env override first
  const envLocale = process.env.MANIFEST_LOCALE;
  if (envLocale) return envLocale;

  // 2. Try franc-min for auto-detection
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { franc } = require('franc-min') as { franc: (text: string) => string };
    const lang = franc(text);
    // franc returns 'und' when undetermined
    if (lang && lang !== 'und') return lang;
  } catch {
    // franc-min not installed — skip detection, use English
  }

  return null;
}

/**
 * Returns the locale keyword set for a given language code, or null if the
 * language is not supported (falls through to English-only scoring).
 */
export function getLocaleKeywords(lang: string | null): LocaleKeywords | null {
  if (!lang) return null;
  return LOCALE_KEYWORDS[lang] ?? LOCALE_KEYWORDS[lang.split('-')[0]] ?? null;
}

/**
 * Merges locale-specific complexity keywords into the base English set.
 * Returns a new merged object — does not mutate the originals.
 */
export function mergeComplexityKeywords(
  base: Record<string, string[]>,
  locale: LocaleKeywords | null,
): Record<string, string[]> {
  if (!locale) return base;

  const merged: Record<string, string[]> = { ...base };
  for (const [dimension, keywords] of Object.entries(locale.complexity)) {
    merged[dimension] = [...(merged[dimension] ?? []), ...keywords];
  }
  return merged;
}
