import {
  KNOWN_OPERATION_TYPES,
  SEMANTIC_OPS,
  isKnownOperationType,
  riskClassFor,
} from '../src/operation';
import { CATALOG_VERSION } from '../src/contract';

describe('operation catalog', () => {
  it('CATALOG_VERSION is 1', () => {
    expect(CATALOG_VERSION).toBe(1);
  });

  it('knows all twelve operation types', () => {
    expect(KNOWN_OPERATION_TYPES.size).toBe(12);
  });

  describe('riskClassFor', () => {
    it('is auto_safe for a catalog of safe ops', () => {
      expect(riskClassFor([{ type: 'remap_model', from: 'a', to: 'b' }, { type: 'drop_param', param: 'x' }])).toBe('auto_safe');
    });
    it('is semantic when any op changes request meaning', () => {
      expect(riskClassFor([{ type: 'trim_context', strategy: 'drop_oldest', targetTokens: 10 }])).toBe('semantic');
      expect(riskClassFor([{ type: 'drop_oversized_content', maxBytes: 100 }])).toBe('semantic');
    });
    it('marks both semantic ops', () => {
      expect(SEMANTIC_OPS.has('trim_context')).toBe(true);
      expect(SEMANTIC_OPS.has('drop_oversized_content')).toBe(true);
    });
  });

  describe('isKnownOperationType', () => {
    it('accepts a catalog type', () => {
      expect(isKnownOperationType('remap_model')).toBe(true);
    });
    it('rejects an unknown string', () => {
      expect(isKnownOperationType('bogus')).toBe(false);
    });
    it('rejects a non-string', () => {
      expect(isKnownOperationType(42)).toBe(false);
      expect(isKnownOperationType(undefined)).toBe(false);
    });
  });
});
