import type { Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';

/** Matches {{ ... }} template variables (non-greedy, no nested braces) */
const TEMPLATE_PATTERN = /\{\{[^{}]+\}\}/g;

/**
 * Determines if a template match at a given index is inside a JSON string
 * (between unescaped double quotes).
 */
function isInsideString(text: string, matchStart: number): boolean {
  let insideString = false;
  for (let i = 0; i < matchStart; i++) {
    if (text[i] === '"' && (i === 0 || text[i - 1] !== '\\')) {
      insideString = !insideString;
    }
  }
  return insideString;
}

/**
 * Builds a position-offset map for translating error positions from
 * preprocessed text back to the original text.
 */
function buildOffsetMap(
  replacements: Array<{ start: number; end: number; replacementLength: number }>
): (preprocessedPos: number) => number {
  return (preprocessedPos: number) => {
    let cumulativeShift = 0;
    for (const r of replacements) {
      const preprocessedStart = r.start - cumulativeShift;
      const preprocessedEnd = preprocessedStart + r.replacementLength;

      if (preprocessedPos <= preprocessedStart) break;
      if (preprocessedPos >= preprocessedEnd) {
        cumulativeShift += (r.end - r.start) - r.replacementLength;
      }
    }
    return preprocessedPos + cumulativeShift;
  };
}

/**
 * Creates a CodeMirror linter that validates JSON while tolerating {{ }}
 * template variable placeholders.
 *
 * Pre-processes text by replacing:
 * - Bare {{ }} (outside quotes) with `null`
 * - In-string {{ }} (inside quotes) with empty string
 *
 * Then runs JSON.parse() and maps errors back to original positions.
 */
export function createRelaxedJsonLinter(): (view: EditorView) => Diagnostic[] {
  return (view: EditorView): Diagnostic[] => {
    const text = view.state.doc.toString();

    if (!text.trim()) return [];

    const replacements: Array<{ start: number; end: number; replacementLength: number }> = [];
    let preprocessed = text;
    let offset = 0;

    // Collect all template matches and replace them
    const matches = [...text.matchAll(TEMPLATE_PATTERN)];
    for (const match of matches) {
      const originalStart = match.index!;
      const originalEnd = originalStart + match[0].length;
      const adjustedStart = originalStart - offset;

      const inString = isInsideString(text, originalStart);
      const replacement = inString ? '' : 'null';

      preprocessed =
        preprocessed.slice(0, adjustedStart) +
        replacement +
        preprocessed.slice(adjustedStart + match[0].length);

      replacements.push({
        start: originalStart,
        end: originalEnd,
        replacementLength: replacement.length,
      });

      offset += match[0].length - replacement.length;
    }

    // Try to parse the preprocessed JSON
    try {
      JSON.parse(preprocessed);
      return [];
    } catch (e) {
      if (!(e instanceof SyntaxError)) return [];

      // Extract position from the error message
      const posMatch = e.message.match(/position\s+(\d+)/i);
      let from = 0;
      if (posMatch) {
        const preprocessedPos = parseInt(posMatch[1], 10);
        const toOriginal = buildOffsetMap(replacements);
        from = toOriginal(preprocessedPos);
      }

      // Clamp to document bounds
      const docLength = view.state.doc.length;
      from = Math.min(from, docLength);
      const to = Math.min(from + 1, docLength);

      return [
        {
          from,
          to,
          severity: 'error',
          message: e.message,
        },
      ];
    }
  };
}
