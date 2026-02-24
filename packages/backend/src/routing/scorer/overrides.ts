import { ScorerConfig, ScorerInput } from './types';
import { isWordCharCode } from './keyword-trie';

export function hasWordBoundaryMatch(text: string, keyword: string): boolean {
  const kwLower = keyword.toLowerCase();
  let idx = text.indexOf(kwLower);
  while (idx !== -1) {
    const beforeOk = idx === 0 || !isWordCharCode(text.charCodeAt(idx - 1));
    const afterEnd = idx + kwLower.length;
    const afterOk = afterEnd >= text.length || !isWordCharCode(text.charCodeAt(afterEnd));
    if (beforeOk && afterOk) return true;
    idx = text.indexOf(kwLower, idx + 1);
  }
  return false;
}

export function checkFormalLogicOverride(
  config: ScorerConfig,
  lastUserText: string,
): boolean {
  const formalDim = config.dimensions.find(
    (d) => d.name === 'formalLogic',
  );
  if (!formalDim?.keywords || lastUserText.length === 0) return false;

  const lastTextLower = lastUserText.toLowerCase();
  for (const kw of formalDim.keywords) {
    if (hasWordBoundaryMatch(lastTextLower, kw)) return true;
  }
  return false;
}

export function estimateTotalTokens(messages: ScorerInput['messages']): number {
  let chars = 0;
  for (const msg of messages) {
    if (msg.content === null || msg.content === undefined) continue;
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (
          block &&
          typeof block === 'object' &&
          'text' in block &&
          typeof (block as Record<string, unknown>).text === 'string'
        ) {
          chars += ((block as Record<string, unknown>).text as string).length;
        }
      }
    } else {
      chars += String(msg.content).length;
    }
  }
  return chars / 4;
}
