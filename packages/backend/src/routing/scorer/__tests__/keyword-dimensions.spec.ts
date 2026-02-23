import { scoreKeywordDimension } from '../dimensions/keyword-dimensions';
import { KeywordTrie } from '../keyword-trie';
import { ExtractedText } from '../text-extractor';

function makeExtracted(text: string, weight = 1.0): ExtractedText[] {
  return [{ text, positionWeight: weight, messageIndex: 0 }];
}

function scanWith(
  dimName: string,
  keywords: string[],
  text: string,
): ReturnType<KeywordTrie['scan']> {
  const trie = new KeywordTrie([{ name: dimName, keywords }]);
  return trie.scan(text);
}

describe('scoreKeywordDimension', () => {
  it('returns 0 for empty text', () => {
    const result = scoreKeywordDimension('formalLogic', [], [], 'up');
    expect(result.rawScore).toBe(0);
    expect(result.matchedKeywords).toEqual([]);
  });

  it('scores formalLogic positively for "prove this theorem"', () => {
    const text = 'prove this theorem';
    const matches = scanWith('formalLogic', ['prove', 'theorem'], text);
    const result = scoreKeywordDimension(
      'formalLogic',
      matches,
      makeExtracted(text),
      'up',
    );
    expect(result.rawScore).toBeGreaterThan(0);
    expect(result.matchedKeywords).toContain('prove');
    expect(result.matchedKeywords).toContain('theorem');
  });

  it('scores analyticalReasoning for trade-offs', () => {
    const text = 'compare the trade-offs and evaluate implications';
    const matches = scanWith(
      'analyticalReasoning',
      ['compare', 'trade-offs', 'evaluate', 'implications'],
      text,
    );
    const result = scoreKeywordDimension(
      'analyticalReasoning',
      matches,
      makeExtracted(text),
      'up',
    );
    expect(result.rawScore).toBeGreaterThan(0);
  });

  it('scores codeGeneration for "write a function"', () => {
    const text = 'write a function to sort an array';
    const matches = scanWith(
      'codeGeneration',
      ['write a function'],
      text,
    );
    const result = scoreKeywordDimension(
      'codeGeneration',
      matches,
      makeExtracted(text),
      'up',
    );
    expect(result.rawScore).toBeGreaterThan(0);
  });

  it('scores codeReview for "fix this bug"', () => {
    const text = 'fix this bug in my authentication code';
    const matches = scanWith(
      'codeReview',
      ['fix this bug'],
      text,
    );
    const result = scoreKeywordDimension(
      'codeReview',
      matches,
      makeExtracted(text),
      'up',
    );
    expect(result.rawScore).toBeGreaterThan(0);
  });

  it('scores simpleIndicators NEGATIVELY (direction: down)', () => {
    const text = 'what is a dog';
    const matches = scanWith(
      'simpleIndicators',
      ['what is'],
      text,
    );
    const result = scoreKeywordDimension(
      'simpleIndicators',
      matches,
      makeExtracted(text),
      'down',
    );
    expect(result.rawScore).toBeLessThan(0);
  });

  it('scores relay NEGATIVELY (direction: down)', () => {
    const text = 'forward to the team';
    const matches = scanWith('relay', ['forward to'], text);
    const result = scoreKeywordDimension(
      'relay',
      matches,
      makeExtracted(text),
      'down',
    );
    expect(result.rawScore).toBeLessThan(0);
  });

  it('position weighting: last message scores higher', () => {
    const text = 'prove this theorem';
    const keywords = ['prove', 'theorem'];
    const matches = scanWith('formalLogic', keywords, text);

    const lastMsg = scoreKeywordDimension(
      'formalLogic',
      matches,
      makeExtracted(text, 1.0),
      'up',
    );
    const oldMsg = scoreKeywordDimension(
      'formalLogic',
      matches,
      makeExtracted(text, 0.25),
      'up',
    );
    expect(lastMsg.rawScore).toBeGreaterThan(oldMsg.rawScore);
  });

  it('density bonus: 3+ keywords in 200-char window boosts score at lower position weight', () => {
    const denseText =
      'prove theorem by induction and use deduction with axiom';
    const keywords = [
      'prove', 'theorem', 'induction', 'deduction', 'axiom',
    ];
    const denseMatches = scanWith('formalLogic', keywords, denseText);
    const denseResult = scoreKeywordDimension(
      'formalLogic',
      denseMatches,
      makeExtracted(denseText, 0.5),
      'up',
    );

    const sparseText =
      'prove something. ' +
      'x'.repeat(250) +
      ' theorem here. ' +
      'x'.repeat(250) +
      ' induction.';
    const sparseMatches = scanWith('formalLogic', keywords, sparseText);
    const sparseResult = scoreKeywordDimension(
      'formalLogic',
      sparseMatches,
      makeExtracted(sparseText, 0.5),
      'up',
    );

    expect(denseResult.rawScore).toBeGreaterThan(sparseResult.rawScore);
  });

  it('returns 0 when no matches for the dimension', () => {
    const matches = scanWith('other', ['something'], 'no keywords here');
    const result = scoreKeywordDimension(
      'formalLogic',
      matches,
      makeExtracted('no keywords here'),
      'up',
    );
    expect(result.rawScore).toBe(0);
  });

  it('deduplicates matched keywords when same keyword appears multiple times', () => {
    const text = 'prove that you can prove it with a solid proof';
    const matches = scanWith('formalLogic', ['prove', 'proof'], text);
    const result = scoreKeywordDimension(
      'formalLogic',
      matches,
      makeExtracted(text),
      'up',
    );
    expect(result.matchedKeywords).toHaveLength(2);
    expect(new Set(result.matchedKeywords).size).toBe(2);
  });

  it('scores across multiple extracted texts from different messages', () => {
    const keywords = ['prove', 'theorem'];
    const text1 = 'prove this';
    const text2 = 'verify the theorem';
    const combined = text1 + '\n' + text2;
    const matches = scanWith('formalLogic', keywords, combined);
    const extracted: ExtractedText[] = [
      { text: text1, positionWeight: 0.5, messageIndex: 0 },
      { text: text2, positionWeight: 1.0, messageIndex: 1 },
    ];
    const result = scoreKeywordDimension(
      'formalLogic',
      matches,
      extracted,
      'up',
    );
    expect(result.rawScore).toBeGreaterThan(0);
    expect(result.matchedKeywords).toContain('prove');
    expect(result.matchedKeywords).toContain('theorem');
  });

  it('clamps rawScore to [-1, 1] range', () => {
    const text = 'prove theorem induction deduction axiom postulate';
    const keywords = ['prove', 'theorem', 'induction', 'deduction', 'axiom', 'postulate'];
    const matches = scanWith('formalLogic', keywords, text);
    const result = scoreKeywordDimension(
      'formalLogic',
      matches,
      makeExtracted(text, 1.0),
      'up',
    );
    expect(result.rawScore).toBeLessThanOrEqual(1);
    expect(result.rawScore).toBeGreaterThanOrEqual(-1);
  });
});
