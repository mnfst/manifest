/** All cardinal categories defined by CLDR/Intl.PluralRules. */
export const pluralCategories = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

export type PluralCategory = (typeof pluralCategories)[number];

/**
 * Only `other` is universally required. Locale-specific catalog validation
 * ensures that every category selected by that locale's Intl.PluralRules is
 * present, without forcing English to carry fake Arabic/Welsh-style forms.
 */
export type PluralMessage = Readonly<
  { other: string } & Partial<Record<Exclude<PluralCategory, 'other'>, string>>
>;

export type MessageCatalog = Readonly<Record<string, string | PluralMessage>>;

/**
 * Preserves the source catalog's keys and message kinds while allowing each
 * locale to provide its own text. Keeping this structural relationship at the
 * type level makes a missing translation a compile error.
 */
export type LocalizedCatalog<Source extends MessageCatalog> = {
  readonly [Key in keyof Source]: Source[Key] extends string
    ? string
    : Source[Key] extends PluralMessage
      ? PluralMessage
      : never;
};

export type InterpolationValue = string | number;

export interface NamedCatalog {
  name: string;
  catalog: MessageCatalog;
}

/** Return semantic keys declared by more than one feature source. */
export function duplicateCatalogKeys(sources: readonly NamedCatalog[]): string[] {
  const owners = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const { name, catalog } of sources) {
    for (const key of Object.keys(catalog)) {
      const owner = owners.get(key);
      if (owner && owner !== name) duplicates.add(key);
      else owners.set(key, name);
    }
  }

  return [...duplicates].sort();
}
