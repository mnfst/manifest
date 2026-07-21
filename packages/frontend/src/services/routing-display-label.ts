import { t } from '../i18n/index.js';
import { SPECIFICITY_STAGES } from './providers.js';

/** Resolve stored routing identifiers at the presentation boundary. */
export function routingDisplayLabel(identifier: string): string {
  if (identifier === 'fallback') return t('message.fallbackLabel');
  return SPECIFICITY_STAGES.find((stage) => stage.id === identifier)?.label ?? identifier;
}
