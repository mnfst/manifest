import { TrieMatch } from '../keyword-trie';
import { ExtractedText } from '../text-extractor';
import { DimensionConfig } from '../types';

const DENSITY_WINDOW = 200;
const DENSITY_THRESHOLD = 3;
const DENSITY_BONUS = 1.5;

function hasDensityCluster(
  matches: TrieMatch[],
  windowSize: number,
): boolean {
  if (matches.length < DENSITY_THRESHOLD) return false;

  const positions = matches.map((m) => m.position).sort((a, b) => a - b);
  for (let i = 0; i <= positions.length - DENSITY_THRESHOLD; i++) {
    if (
      positions[i + DENSITY_THRESHOLD - 1] - positions[i] <=
      windowSize
    ) {
      return true;
    }
  }
  return false;
}

export function scoreKeywordDimension(
  dimensionName: string,
  allMatches: TrieMatch[],
  extractedTexts: ExtractedText[],
  direction: DimensionConfig['direction'],
): { rawScore: number; matchedKeywords: string[] } {
  const dimMatches = allMatches.filter(
    (m) => m.dimension === dimensionName,
  );
  if (dimMatches.length === 0) {
    return { rawScore: 0, matchedKeywords: [] };
  }

  const uniqueKeywords = [...new Set(dimMatches.map((m) => m.keyword))];
  const densityActive = hasDensityCluster(dimMatches, DENSITY_WINDOW);

  let weightedSum = 0;

  for (const ext of extractedTexts) {
    const textLower = ext.text.toLowerCase();
    let chunkCount = 0;

    for (const match of dimMatches) {
      if (textLower.includes(match.keyword)) {
        chunkCount++;
      }
    }

    if (chunkCount > 0) {
      let contribution = chunkCount * ext.positionWeight;
      if (densityActive) contribution *= DENSITY_BONUS;
      weightedSum += contribution;
    }
  }

  const normalizer = Math.max(1, dimMatches.length);
  let rawScore = Math.min(1, Math.max(-1, weightedSum / normalizer));

  if (direction === 'down') rawScore = -rawScore;

  return { rawScore, matchedKeywords: uniqueKeywords };
}
