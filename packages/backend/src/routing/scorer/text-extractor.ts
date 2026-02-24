import { ScorerMessage } from './types';

export interface ExtractedText {
  text: string;
  positionWeight: number;
  messageIndex: number;
}

function extractTextFromContent(content: unknown): string {
  if (content === null || content === undefined) return '';

  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const element of content) {
      if (
        element &&
        typeof element === 'object' &&
        'text' in element &&
        typeof (element as Record<string, unknown>).text === 'string'
      ) {
        parts.push((element as Record<string, unknown>).text as string);
      }
    }
    return parts.join(' ');
  }

  return String(content);
}

const EXCLUDED_ROLES = new Set(['system', 'developer']);

export function extractUserTexts(
  messages: ScorerMessage[],
): ExtractedText[] {
  const userMessages: { text: string; index: number }[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (EXCLUDED_ROLES.has(msg.role)) continue;
    if (msg.role !== 'user') continue;

    const text = extractTextFromContent(msg.content);
    if (text.length === 0) continue;

    userMessages.push({ text, index: i });
  }

  const total = userMessages.length;
  return userMessages.map((um, idx) => {
    const reverseIdx = total - 1 - idx;
    let weight: number;
    if (reverseIdx === 0) weight = 1.0;
    else if (reverseIdx === 1) weight = 0.5;
    else weight = 0.25;

    return {
      text: um.text,
      positionWeight: weight,
      messageIndex: um.index,
    };
  });
}

export function countConversationMessages(
  messages: ScorerMessage[],
): number {
  let count = 0;
  for (const msg of messages) {
    if (!EXCLUDED_ROLES.has(msg.role)) count++;
  }
  return count;
}

export function combinedText(extracted: ExtractedText[]): string {
  return extracted.map((e) => e.text).join('\n');
}
