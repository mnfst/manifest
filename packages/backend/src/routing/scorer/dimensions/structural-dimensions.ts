function lerp(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

export function scoreTokenCount(text: string): number {
  const estimatedTokens = text.length / 4;

  if (estimatedTokens < 50) return -0.5;
  if (estimatedTokens <= 200) return lerp(estimatedTokens, 50, 200, -0.5, 0);
  if (estimatedTokens <= 500) return lerp(estimatedTokens, 200, 500, 0, 0.3);
  return 0.5;
}

export function scoreNestedListDepth(text: string): number {
  const listPattern = /^(\s+)(?:[-*+]\s|\d+[.)]\s)/gm;
  const indentLevels = new Set<number>();
  let match: RegExpExecArray | null;

  while ((match = listPattern.exec(text)) !== null) {
    indentLevels.add(match[1].length);
  }

  const levels = indentLevels.size;
  if (levels === 0) return 0;
  if (levels === 1) return 0.3;
  if (levels === 2) return 0.6;
  return 0.9;
}

const CONDITIONAL_PATTERNS = [
  /\bif\b.*?\bthen\b/gi,
  /\botherwise\b/gi,
  /\bunless\b/gi,
  /\bdepending on\b/gi,
  /\bwhen\b.*?\bhappens?\b/gi,
  /\bin case\b/gi,
  /\bprovided that\b/gi,
  /\bassuming\b/gi,
  /\bgiven that\b/gi,
  /\bon condition\b/gi,
];

export function scoreConditionalLogic(text: string): number {
  let count = 0;

  for (const pattern of CONDITIONAL_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }

  if (count === 0) return 0;
  if (count === 1) return 0.3;
  if (count === 2) return 0.6;
  return 0.9;
}

export function scoreCodeToProse(text: string): number {
  if (text.length === 0) return 0;

  let codeChars = 0;

  const fencePattern = /```[\s\S]*?(?:```|$)/g;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencePattern.exec(text)) !== null) {
    const inner = fenceMatch[0]
      .replace(/^```[^\n]*\n?/, '')
      .replace(/```$/, '');
    codeChars += inner.length;
  }

  const inlinePattern = /`([^`]+)`/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlinePattern.exec(text)) !== null) {
    codeChars += inlineMatch[1].length * 0.5;
  }

  if (codeChars === 0) return 0;

  const ratio = codeChars / text.length;
  return Math.min(0.9, ratio * 1.5);
}

const CONSTRAINT_PATTERNS = [
  /\bat most\b/gi,
  /\bat least\b/gi,
  /\bexactly\s+\d+/gi,
  /\bno more than\b/gi,
  /\bmust not\b/gi,
  /\bmust be\b/gi,
  /\bshould not\b/gi,
  /\bcannot exceed\b/gi,
  /\bwithin\s+\d+/gi,
  /\bbetween\s+\S+\s+and\s+\S+/gi,
  /O\([^)]+\)/g,
  /\/[^/\s]+\//g,
];

export function scoreConstraintDensity(text: string): number {
  if (text.length === 0) return 0;

  let count = 0;
  for (const pattern of CONSTRAINT_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return 0;

  const density = (count / wordCount) * 100;

  if (density < 0.5) return 0;
  return Math.min(0.9, lerp(density, 0.5, 3, 0, 0.9));
}
