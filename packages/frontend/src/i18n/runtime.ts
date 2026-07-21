import type { InterpolationValue, MessageCatalog, PluralMessage } from './catalog-types.js';
import { formatNumber } from './formatters.js';
import {
  activateLocale,
  locale,
  localeTag,
  resolveLocale,
  type Locale,
  type LocaleEnvironment,
} from './locale.js';
import type en from './messages/en/index.js';

/** Optional, domain-neutral data that is loaded with a locale catalogue. */
export type LocaleMetadata = Readonly<Record<string, Readonly<Record<string, string>>>>;

type CatalogModule = Readonly<{
  default: MessageCatalog;
  metadata?: LocaleMetadata;
}>;
export type CatalogLoader = () => Promise<CatalogModule>;

const catalogLoaders: Readonly<Record<Locale, CatalogLoader>> = {
  en: () => import('./messages/en/index.js'),
  ru: () => import('./messages/ru/index.js'),
};

interface LoadedCatalog {
  loader: CatalogLoader;
  messages: MessageCatalog;
  metadata?: LocaleMetadata;
}

const loadedCatalogs = new Map<Locale, LoadedCatalog>();
const pendingCatalogs = new Map<Locale, { loader: CatalogLoader; promise: Promise<void> }>();
let latestLocaleRequest = 0;

export type MessageKey = keyof typeof en;
export type TextMessageKey = {
  [Key in MessageKey]: (typeof en)[Key] extends string ? Key : never;
}[MessageKey];
export type PluralMessageKey = Exclude<MessageKey, TextMessageKey>;

type Placeholders<Text> = Text extends string
  ? Text extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never
  : Text extends PluralMessage
    ? Placeholders<Text[keyof Text]>
    : never;

export type PlainTextMessageKey = {
  [Key in TextMessageKey]: [Placeholders<(typeof en)[Key]>] extends [never] ? Key : never;
}[TextMessageKey];

export type InterpolatedMessageKey = Exclude<TextMessageKey, PlainTextMessageKey>;

type Params<Names extends string, Value = InterpolationValue> = Readonly<Record<Names, Value>>;

type TranslationArgs<Key extends TextMessageKey> = [Placeholders<(typeof en)[Key]>] extends [never]
  ? [params?: Readonly<Record<string, never>>]
  : [params: Params<Placeholders<(typeof en)[Key]>>];

type PluralArgs<Key extends PluralMessageKey> = [
  Exclude<Placeholders<(typeof en)[Key]>, 'count'>,
] extends [never]
  ? [params?: Readonly<Record<string, never>>]
  : [params: Params<Exclude<Placeholders<(typeof en)[Key]>, 'count'>>];

const reportedProblems = new Set<string>();

function reportProblem(problem: string): void {
  if (!import.meta.env.DEV || reportedProblems.has(problem)) return;
  reportedProblems.add(problem);
  console.warn(`[i18n] ${problem}`);
}

async function loadCatalog(value: Locale, loader: CatalogLoader): Promise<void> {
  if (loadedCatalogs.get(value)?.loader === loader) return;
  const pending = pendingCatalogs.get(value);
  if (pending?.loader === loader) return pending.promise;

  const promise = loader()
    .then((module) => {
      loadedCatalogs.set(value, {
        loader,
        messages: module.default,
        metadata: module.metadata,
      });
    })
    .finally(() => {
      if (pendingCatalogs.get(value)?.promise === promise) pendingCatalogs.delete(value);
    });
  pendingCatalogs.set(value, { loader, promise });
  return promise;
}

async function loadRequestedOrEnglish(
  requested: Locale,
  loaders: Readonly<Record<Locale, CatalogLoader>>,
): Promise<Locale> {
  if (requested === 'en') {
    await loadCatalog('en', loaders.en);
    return 'en';
  }

  // A non-English session needs its selected catalogue and the canonical
  // English per-key fallback, but both remain dynamic chunks and are absent
  // from the English initial entry graph.
  const englishFallback = loadCatalog('en', loaders.en);
  try {
    await Promise.all([loadCatalog(requested, loaders[requested]), englishFallback]);
    return requested;
  } catch {
    reportProblem(`Failed to load ${requested} catalogue; falling back to English`);
    await englishFallback;
    return 'en';
  }
}

/** Load the initial catalogue before the application renders. */
export async function initializeI18n(
  environment?: LocaleEnvironment,
  loaders: Readonly<Record<Locale, CatalogLoader>> = catalogLoaders,
): Promise<Locale> {
  const requested = resolveLocale(environment);
  const loaded = await loadRequestedOrEnglish(requested, loaders);
  activateLocale(loaded, false);
  return loaded;
}

/**
 * Load before activation so users never see semantic keys or a half-switched UI.
 * A monotonically increasing request id ensures the last selector choice wins
 * even when locale chunks resolve out of order.
 */
export async function setLocale(
  value: Locale,
  loaders: Readonly<Record<Locale, CatalogLoader>> = catalogLoaders,
): Promise<Locale> {
  const requestId = ++latestLocaleRequest;
  const loaded = await loadRequestedOrEnglish(value, loaders);
  if (requestId !== latestLocaleRequest) return locale();
  activateLocale(loaded, true);
  return loaded;
}

/**
 * Resolve optional domain metadata from the active locale chunk. Metadata is
 * intentionally generic so future catalogues can extend it without changing
 * the i18n runtime. The source text is the final, always-readable fallback.
 */
export function localeMetadata(section: string, source: string): string {
  return (
    loadedCatalogs.get(locale())?.metadata?.[section]?.[source] ??
    loadedCatalogs.get('en')?.metadata?.[section]?.[source] ??
    source
  );
}

function getMessage(key: MessageKey): string | PluralMessage | undefined {
  const localized = loadedCatalogs.get(locale())?.messages as
    | Partial<Record<MessageKey, string | PluralMessage>>
    | undefined;
  const fallback = loadedCatalogs.get('en')?.messages as
    | Partial<Record<MessageKey, string | PluralMessage>>
    | undefined;
  const message = localized?.[key] ?? fallback?.[key];

  if (message === undefined) reportProblem(`Missing message: ${String(key)}`);
  return message;
}

function interpolate(
  template: string,
  params: Readonly<Record<string, InterpolationValue>>,
): string {
  return template.replace(/\{([a-zA-Z][\w.]*)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) {
      reportProblem(`Missing interpolation value: ${name}`);
      return placeholder;
    }
    return String(value);
  });
}

export function t<Key extends TextMessageKey>(
  key: Key,
  ...[params = {}]: TranslationArgs<Key>
): string {
  const message = getMessage(key);
  if (message === undefined) return String(key);
  if (typeof message !== 'string') {
    reportProblem(`Expected a text message: ${String(key)}`);
    return String(key);
  }

  return interpolate(message, params);
}

/**
 * Interpolate non-string values (for example JSX <code> nodes) without taking
 * a dependency on a rendering framework. The canonical English catalogue
 * still provides compile-time placeholder names and each occurrence preserves
 * the locale-specific sentence order.
 */
export function tr<Key extends InterpolatedMessageKey, Part>(
  key: Key,
  params: Params<Placeholders<(typeof en)[Key]>, Part>,
): Array<string | Part> {
  const message = getMessage(key);
  if (message === undefined) return [String(key)];
  if (typeof message !== 'string') {
    reportProblem(`Expected a text message: ${String(key)}`);
    return [String(key)];
  }

  const parts: Array<string | Part> = [];
  const placeholderPattern = /\{([a-zA-Z][\w.]*)\}/g;
  let cursor = 0;
  for (const match of message.matchAll(placeholderPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(message.slice(cursor, index));
    const placeholder = match[0];
    const name = match[1] as Placeholders<(typeof en)[Key]>;
    const value = params[name];
    if (value === undefined) {
      reportProblem(`Missing interpolation value: ${String(name)}`);
      parts.push(placeholder);
    } else {
      parts.push(value);
    }
    cursor = index + placeholder.length;
  }
  if (cursor < message.length) parts.push(message.slice(cursor));
  return parts;
}

const pluralRulesByLocale = new Map<string, Intl.PluralRules>();

export function pluralCategory(count: number): Intl.LDMLPluralRule {
  const tag = localeTag();
  let rules = pluralRulesByLocale.get(tag);
  if (!rules) {
    rules = new Intl.PluralRules(tag);
    pluralRulesByLocale.set(tag, rules);
  }
  return rules.select(count);
}

/** Select a CLDR plural form, always falling back to the mandatory `other`. */
export function selectPluralForm(message: PluralMessage, category: Intl.LDMLPluralRule): string {
  return message[category] ?? message.other;
}

export function tp<Key extends PluralMessageKey>(
  key: Key,
  count: number,
  ...[params = {}]: PluralArgs<Key>
): string {
  const message = getMessage(key);
  if (message === undefined) return String(key);
  if (typeof message === 'string') {
    reportProblem(`Expected a plural message: ${String(key)}`);
    return String(key);
  }

  const template = selectPluralForm(message, pluralCategory(count));
  return interpolate(template, { ...params, count: formatNumber(count) });
}
