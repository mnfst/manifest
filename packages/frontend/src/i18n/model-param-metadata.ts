import { localeMetadata } from './runtime.js';

/** Return a translated label only when the active locale chunk provides an exact match. */
export function localizeModelParamLabel(source: string): string {
  return localeMetadata('modelParamLabels', source);
}

/** Return a translated description only when the active locale chunk provides an exact match. */
export function localizeModelParamDescription(source: string): string {
  return localeMetadata('modelParamDescriptions', source);
}
