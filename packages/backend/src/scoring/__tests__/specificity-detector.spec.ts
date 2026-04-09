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
    it('should pick the category with the highest score', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        match('class', 'codeGeneration', 10),
        match('refactor', 'codeReview', 20),
        match('navigate', 'webBrowsing', 30),
        match('click', 'webBrowsing', 40),
      ];
      const result = detectSpecificity(matches);
      expect(result).not.toBeNull();
      expect(result!.category).toBe('coding');
    });

    it('should pick web_browsing when it has the highest score', () => {
      const matches = [
        match('function', 'codeGeneration', 0),
        match('navigate', 'webBrowsing', 10),
        match('click', 'webBrowsing', 20),
        match('scroll', 'webBrowsing', 30),
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
