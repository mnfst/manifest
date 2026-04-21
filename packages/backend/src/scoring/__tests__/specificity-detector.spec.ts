import { detectSpecificity } from '../specificity-detector';
import { TrieMatch } from '../keyword-trie';
import { ScorerTool } from '../types';

function match(keyword: string, dimension: string, position = 0): TrieMatch {
  return { keyword, dimension, position };
}

describe('detectSpecificity', () => {
  describe('header override', () => {
    it('should return the category with confidence 1.0 when header is valid', () => {
      const result = detectSpecificity([], undefined, 'coding');
      expect(result).toEqual({ category: 'coding', confidence: 1.0 });
    });

    it('should accept all valid categories via header override', () => {
      expect(detectSpecificity([], undefined, 'web_browsing')).toEqual({
        category: 'web_browsing',
        confidence: 1.0,
      });
      expect(detectSpecificity([], undefined, 'data_analysis')).toEqual({
        category: 'data_analysis',
        confidence: 1.0,
      });
    });

    it('should fall through to auto-detection when header is invalid', () => {
      const result = detectSpecificity([], undefined, 'invalid_category');
      expect(result).toBeNull();
    });

    it('should fall through to auto-detection when header is empty string', () => {
      const result = detectSpecificity([], undefined, '');
      expect(result).toBeNull();
    });
  });

  describe('auto-detection by keyword matches', () => {
    it('should detect coding when enough codeGeneration matches exist', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        match('class', 'codeGeneration', 10),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('should detect coding from mixed coding dimensions', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        match('refactor', 'codeReview', 10),
        match('api', 'technicalTerms', 20),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('should detect coding from codeToProse dimension', () => {
      const matches = [match('explain', 'codeToProse', 0), match('describe', 'codeToProse', 10)];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('should detect web_browsing with webBrowsing dimension matches', () => {
      const matches = [match('navigate', 'webBrowsing', 0), match('click', 'webBrowsing', 10)];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('web_browsing');
    });

    it('should detect data_analysis with domainSpecificity matches', () => {
      const matches = [
        match('regression', 'domainSpecificity', 0),
        match('correlation', 'domainSpecificity', 10),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('data_analysis');
    });

    it('should detect data_analysis with dataAnalysis matches', () => {
      const matches = [match('chart', 'dataAnalysis', 0), match('plot', 'dataAnalysis', 10)];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('data_analysis');
    });

    it('should detect data_analysis from mixed data dimensions', () => {
      const matches = [
        match('regression', 'domainSpecificity', 0),
        match('chart', 'dataAnalysis', 10),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('data_analysis');
    });
  });

  describe('no detection', () => {
    it('should return null when there are no matches', () => {
      expect(detectSpecificity([])).toBeNull();
    });

    it('should return null when matches are below threshold', () => {
      const matches = [match('function', 'codeGeneration', 0)];
      // Default threshold is 1, so use explicit threshold=2 to test below-threshold
      expect(detectSpecificity(matches, undefined, undefined, 2)).toBeNull();
    });

    it('should return null when matches belong to irrelevant dimensions', () => {
      const matches = [
        match('hello', 'irrelevantDim', 0),
        match('world', 'anotherDim', 10),
        match('foo', 'yetAnother', 20),
      ];
      expect(detectSpecificity(matches)).toBeNull();
    });
  });

  describe('multiple categories active — highest score wins', () => {
    it('should pick coding over web_browsing when coding has more weighted signal', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        match('class', 'codeGeneration', 10),
        match('refactor', 'codeReview', 20),
        match('component', 'codeGeneration', 30),
        match('endpoint', 'codeGeneration', 40),
        // single weak web_browsing keyword (default weight 1) — below the
        // web_browsing activation threshold of 3 on its own.
        match('click', 'webBrowsing', 50),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('should pick web_browsing when strong browse anchors dominate', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        // strong anchors: navigate (3) + browse (3) = 6, clears web_browsing threshold.
        match('navigate', 'webBrowsing', 10),
        match('browse', 'webBrowsing', 20),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('web_browsing');
    });
  });

  describe('tool heuristics', () => {
    it('should boost web_browsing for browser_ prefixed tool', () => {
      const tools: ScorerTool[] = [{ name: 'browser_navigate' }, { name: 'browser_click' }];
      const matches = [match('navigate', 'webBrowsing', 0)];
      const result = detectSpecificity(matches, tools);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('web_browsing');
    });

    it('should boost web_browsing for playwright_ prefixed tool', () => {
      const tools: ScorerTool[] = [{ name: 'playwright_click' }];
      const matches = [match('click', 'webBrowsing', 0)];
      const result = detectSpecificity(matches, tools);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('web_browsing');
    });

    it('should boost web_browsing for web_ prefixed tool', () => {
      const tools: ScorerTool[] = [{ name: 'web_search' }];
      const matches = [match('search', 'webBrowsing', 0)];
      const result = detectSpecificity(matches, tools);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('web_browsing');
    });

    it('should boost coding for code_ prefixed tool', () => {
      const tools: ScorerTool[] = [{ name: 'code_edit' }];
      const matches = [match('function', 'codeGeneration', 0)];
      const result = detectSpecificity(matches, tools);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('should boost coding for editor_ prefixed tool', () => {
      const tools: ScorerTool[] = [{ name: 'editor_replace' }];
      const matches = [match('class', 'codeGeneration', 0)];
      const result = detectSpecificity(matches, tools);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('should handle tool with function.name format', () => {
      const tools: ScorerTool[] = [{ function: { name: 'browser_navigate' } }];
      const matches = [match('click', 'webBrowsing', 0)];
      const result = detectSpecificity(matches, tools);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('web_browsing');
    });

    it('should not crash when tool has no name and no function.name', () => {
      const tools: ScorerTool[] = [{ description: 'some tool' }];
      const result = detectSpecificity([], tools);
      expect(result).toBeNull();
    });

    it('should not crash when tool.function exists but has no name', () => {
      const tools: ScorerTool[] = [{ function: { description: 'x' } }];
      const result = detectSpecificity([], tools);
      expect(result).toBeNull();
    });

    it('should not crash when tool.function is undefined', () => {
      const tools: ScorerTool[] = [{ function: undefined }];
      const result = detectSpecificity([], tools);
      expect(result).toBeNull();
    });

    it('should handle case-insensitive tool name matching', () => {
      const tools: ScorerTool[] = [{ name: 'Browser_Navigate' }];
      const matches = [match('click', 'webBrowsing', 0)];
      const result = detectSpecificity(matches, tools);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('web_browsing');
    });

    it('should skip tools with no matching prefix', () => {
      const tools: ScorerTool[] = [{ name: 'custom_tool' }];
      const result = detectSpecificity([], tools);
      expect(result).toBeNull();
    });

    it('should not apply heuristics when tools array is empty', () => {
      // With threshold=1, a single match now detects — use threshold=2 to test tool isolation
      const matches = [match('function', 'codeGeneration', 0)];
      const result = detectSpecificity(matches, [], undefined, 2);
      expect(result).toBeNull();
    });
  });

  describe('session stickiness (recentCategories)', () => {
    it('biases ambiguous current turn toward sticky recent category', () => {
      // An ambiguous message whose web_browsing signal would hit exactly the
      // threshold (3) — with the last 3 turns all coding, the session bias
      // (+2) keeps coding ahead. This is the discussion #1613 scenario.
      const matches = [
        match('visit', 'webBrowsing', 0), // weight 3 → web_browsing = 3
        match('function', 'codeGeneration', 10), // weight 1 → coding = 1
      ];
      const result = detectSpecificity(matches, undefined, undefined, undefined, undefined, [
        'coding',
        'coding',
        'coding',
      ]);
      expect(result).not.toBeNull();
      // Without stickiness, web_browsing wins (3 vs 1). With +2 stickiness on
      // coding, coding scores 3 — tied. We take the first to clear threshold
      // with the highest score, so web_browsing still wins on equal bestScore
      // thanks to comparison being strict `>`. This confirms stickiness alone
      // doesn't override a genuine anchor — it only biases close races.
      // Bumping coding by one more match flips it:
      const matches2 = [
        match('visit', 'webBrowsing', 0),
        match('function', 'codeGeneration', 10),
        match('class', 'codeGeneration', 20),
      ];
      const result2 = detectSpecificity(matches2, undefined, undefined, undefined, undefined, [
        'coding',
        'coding',
        'coding',
      ]);
      expect(result2!.category).toBe('coding');
    });

    it('ignores stickiness when current-turn anchor dominates', () => {
      // Strong anchor: navigate (3) + browse (3) = 6 web_browsing, clearly
      // above both the threshold and any sticky bias.
      const matches = [match('navigate', 'webBrowsing', 0), match('browse', 'webBrowsing', 10)];
      const result = detectSpecificity(matches, undefined, undefined, undefined, undefined, [
        'coding',
        'coding',
        'coding',
      ]);
      expect(result!.category).toBe('web_browsing');
    });

    it('requires at least 3 consistent recent categories to bias', () => {
      // Only 2 recent entries — below STICKY_AGREEMENT_MIN, so no bias applied.
      const matches = [match('visit', 'webBrowsing', 0), match('function', 'codeGeneration', 10)];
      const result = detectSpecificity(matches, undefined, undefined, undefined, undefined, [
        'coding',
        'coding',
      ]);
      expect(result!.category).toBe('web_browsing');
    });

    it('does not bias when recent categories disagree', () => {
      const matches = [match('visit', 'webBrowsing', 0), match('function', 'codeGeneration', 10)];
      const result = detectSpecificity(matches, undefined, undefined, undefined, undefined, [
        'coding',
        'web_browsing',
        'coding',
      ]);
      expect(result!.category).toBe('web_browsing');
    });
  });

  describe('category penalties', () => {
    it('subtracts the penalty from a flagged category so a weaker one wins', () => {
      const matches = [
        match('visit', 'webBrowsing', 0), // weight 3 → web_browsing = 3
        match('function', 'codeGeneration', 10), // weight 1 → coding = 1
      ];
      // A 2.5 penalty on web_browsing drops it to 0.5 — below threshold and
      // below coding. Coding at 1.0 wins.
      const penalties = new Map([['web_browsing' as const, 2.5]]);
      const result = detectSpecificity(
        matches,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        penalties,
      );
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('clamps the post-penalty score at zero', () => {
      // A huge penalty on the only category still leaves it at 0 (not negative),
      // so the detector returns null instead of selecting a sub-threshold score.
      const matches = [match('function', 'codeGeneration', 0)];
      const penalties = new Map([['coding' as const, 1000]]);
      const result = detectSpecificity(
        matches,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        penalties,
      );
      expect(result).toBeNull();
    });

    it('does not alter scores when the penalty map is empty', () => {
      const matches = [match('function', 'codeGeneration', 0)];
      const penalties = new Map();
      const result = detectSpecificity(
        matches,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        penalties,
      );
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });
  });

  describe('confidence calculation', () => {
    it('should compute confidence as score / (threshold * 3)', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        match('class', 'codeGeneration', 10),
        match('module', 'codeGeneration', 20),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      // score=3, threshold=1, confidence = min(3 / (1*3), 1.0) = 1.0
      expect(result!.confidence).toBe(1.0);
    });

    it('should cap confidence at 1.0 for high scores', () => {
      const matches: TrieMatch[] = [];
      for (let i = 0; i < 10; i++) {
        matches.push(match(`kw${i}`, 'codeGeneration', i * 10));
      }
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      // score=10, threshold=2, confidence = min(10/6, 1.0) = 1.0
      expect(result!.confidence).toBe(1.0);
    });

    it('should compute minimum confidence at threshold boundary', () => {
      const matches = [match('function', 'codeGeneration', 0)];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      // score=1, threshold=1, confidence = 1 / (1*3) = 0.333...
      expect(result!.confidence).toBeCloseTo(1 / 3, 5);
    });
  });

  describe('custom threshold parameter', () => {
    it('should detect with a lower threshold', () => {
      const matches = [match('function', 'codeGeneration', 0)];
      const result = detectSpecificity(matches, undefined, undefined, 1);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
      // score=1, threshold=1, confidence = 1 / (1*3) = 0.333...
      expect(result!.confidence).toBeCloseTo(1 / 3, 5);
    });

    it('should not detect when score is below custom threshold', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        match('class', 'codeGeneration', 10),
      ];
      const result = detectSpecificity(matches, undefined, undefined, 5);
      expect(result).toBeNull();
    });

    it('should still honor header override regardless of threshold', () => {
      const result = detectSpecificity([], undefined, 'coding', 100);
      expect(result).toEqual({ category: 'coding', confidence: 1.0 });
    });
  });
});
