import { OPENCODE_GO_BUDGET_5H_USD, OpencodeGoCatalogService } from './opencode-go-catalog.service';

const BT = String.fromCharCode(96);
const OAI = BT + 'https://opencode.ai/zen/go/v1/chat/completions' + BT;
const ANT = BT + 'https://opencode.ai/zen/go/v1/messages' + BT;
const OAI_SDK = BT + '@ai-sdk/openai-compatible' + BT;
const ANT_SDK = BT + '@ai-sdk/anthropic' + BT;

const ENDPOINTS_TABLE = [
  '## Endpoints',
  '',
  '| Model        | Model ID     | Endpoint                                         | AI SDK Package              |',
  '| ------------ | ------------ | ------------------------------------------------ | --------------------------- |',
  `| GLM-5.1      | glm-5.1      | ${OAI} | ${OAI_SDK} |`,
  `| GLM-5        | glm-5        | ${OAI} | ${OAI_SDK} |`,
  `| Kimi K2.5    | kimi-k2.5    | ${OAI} | ${OAI_SDK} |`,
  `| Qwen3.7 Max  | qwen3.7-max  | ${ANT} | ${ANT_SDK} |`,
  '',
].join('\n');

describe('OpencodeGoCatalogService — malformed MDX edge cases', () => {
  let service: OpencodeGoCatalogService;

  beforeEach(() => {
    service = new OpencodeGoCatalogService();
  });

  describe('non-numeric request counts in Usage Limits table', () => {
    it('skips rows where the request column is "N/A" but keeps other rows', () => {
      const mdx = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| GLM-5.1   | N/A                 | N/A               | N/A                |',
        '| GLM-5     | 1,150               | 2,880             | 5,750              |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(mdx);
      const cost = Object.fromEntries(entries.map((e) => [e.id, e.costPerRequestUsd]));

      // GLM-5.1 row had "N/A" — regex rejects it, so cost stays null.
      expect(cost['glm-5.1']).toBeNull();
      // GLM-5 row had a real number — cost is computed normally.
      expect(cost['glm-5']).toBeCloseTo(OPENCODE_GO_BUDGET_5H_USD / 1150, 12);
    });

    it('skips rows where the request column is "--" placeholder', () => {
      const mdx = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| GLM-5.1   | --                  | --                | --                 |',
        '| GLM-5     | 1,150               | 2,880             | 5,750              |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(mdx);
      const glm51 = entries.find((e) => e.id === 'glm-5.1');
      const glm5 = entries.find((e) => e.id === 'glm-5');

      expect(glm51?.costPerRequestUsd).toBeNull();
      expect(glm5?.costPerRequestUsd).toBeCloseTo(OPENCODE_GO_BUDGET_5H_USD / 1150, 12);
    });

    it('does not crash and still returns all endpoint models when every limits row is non-numeric', () => {
      const mdx = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| GLM-5.1   | N/A                 | N/A               | N/A                |',
        '| GLM-5     | --                  | --                | --                 |',
        '| Kimi K2.5 | TBD                 | TBD               | TBD                |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(mdx);
      // All 4 endpoint models still returned.
      expect(entries.map((e) => e.id).sort()).toEqual([
        'glm-5',
        'glm-5.1',
        'kimi-k2.5',
        'qwen3.7-max',
      ]);
      // Every cost is null — no NaN, no Infinity, no crash.
      for (const entry of entries) {
        expect(entry.costPerRequestUsd).toBeNull();
      }
    });

    it('does not populate the cost index with NaN or Infinity', async () => {
      const mdx = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| GLM-5.1   | N/A                 | N/A               | N/A                |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mdx,
      } as Response);

      try {
        await service.list();
        const cost = service.getCostPerRequest('glm-5.1');
        // Must be exactly null — not NaN, not Infinity, not 0.
        expect(cost).toBeNull();
        // Sanity: also confirm getFormat still works (only cost was dropped).
        expect(service.getFormat('glm-5.1')).toBe('openai');
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('skips rows where the request column is empty/whitespace', () => {
      const mdx = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| GLM-5.1   |                     | 2,150             | 4,300              |',
        '| GLM-5     | 1,150               | 2,880             | 5,750              |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(mdx);
      const glm51 = entries.find((e) => e.id === 'glm-5.1');
      const glm5 = entries.find((e) => e.id === 'glm-5');

      // Empty cell — regex anchored on [0-9] rejects it.
      expect(glm51?.costPerRequestUsd).toBeNull();
      expect(glm5?.costPerRequestUsd).toBeCloseTo(OPENCODE_GO_BUDGET_5H_USD / 1150, 12);
    });
  });

  describe('partially malformed MDX (one table broken)', () => {
    it('returns all models with null cost when Usage Limits table is entirely missing', () => {
      // Endpoints table valid, no Usage Limits section at all.
      const entries = service.parse(ENDPOINTS_TABLE);
      expect(entries).toHaveLength(4);
      for (const entry of entries) {
        expect(entry.costPerRequestUsd).toBeNull();
      }
      // IDs still parsed correctly.
      expect(entries.map((e) => e.id).sort()).toEqual([
        'glm-5',
        'glm-5.1',
        'kimi-k2.5',
        'qwen3.7-max',
      ]);
    });

    it('returns models with null cost when Usage Limits formatting is broken (no numeric columns)', () => {
      // Limits "table" exists but no row matches the 3-numeric-column anchor.
      const broken = [
        '## Usage limits',
        '',
        'These limits are TBD pending pricing review.',
        '',
        '- GLM-5.1: see docs',
        '- GLM-5: see docs',
        '- Kimi K2.5: see docs',
        '',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(broken);
      expect(entries).toHaveLength(4);
      for (const entry of entries) {
        expect(entry.costPerRequestUsd).toBeNull();
      }
    });

    it('returns models with null cost when Usage Limits names do not match any Endpoints name', () => {
      // Limits table has valid numeric rows, but the names are completely
      // different from the endpoints names (e.g. legacy model names).
      const mismatch = [
        '## Usage limits',
        '',
        '| Model           | requests per 5 hour | requests per week | requests per month |',
        '| --------------- | ------------------- | ----------------- | ------------------ |',
        '| Legacy Model A  | 880                 | 2,150             | 4,300              |',
        '| Legacy Model B  | 1,150               | 2,880             | 5,750              |',
        '| Unknown Codename| 1,850               | 4,630             | 9,250              |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(mismatch);
      // All endpoint models still parsed.
      expect(entries).toHaveLength(4);
      // None matched — every cost is null, but no crash.
      for (const entry of entries) {
        expect(entry.costPerRequestUsd).toBeNull();
      }
      // IDs still correct.
      expect(entries.map((e) => e.id).sort()).toEqual([
        'glm-5',
        'glm-5.1',
        'kimi-k2.5',
        'qwen3.7-max',
      ]);
    });

    it('matches the subset that aligns and leaves the rest null when Endpoints/Limits partially overlap', () => {
      // Half the endpoints match Usage Limits rows, half don't.
      const partial = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| GLM-5.1   | 880                 | 2,150             | 4,300              |',
        '| Totally Different Name | 1,150     | 2,880             | 5,750              |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(partial);
      const cost = Object.fromEntries(entries.map((e) => [e.id, e.costPerRequestUsd]));

      // Only GLM-5.1 matched cross-table.
      expect(cost['glm-5.1']).toBeCloseTo(OPENCODE_GO_BUDGET_5H_USD / 880, 12);
      // Rest of the endpoint models got null, not NaN or crash.
      expect(cost['glm-5']).toBeNull();
      expect(cost['kimi-k2.5']).toBeNull();
      expect(cost['qwen3.7-max']).toBeNull();
    });

    it('returns [] when both tables are malformed beyond recognition', () => {
      const garbage = [
        '## Usage limits',
        '',
        'totally not a table',
        '',
        '## Endpoints',
        '',
        'also not a table',
      ].join('\n');

      const entries = service.parse(garbage);
      expect(entries).toEqual([]);
    });

    it('returns [] when the Endpoints table is missing but Usage Limits is intact', () => {
      // Inverse of the above — limits table present, endpoints missing.
      // Without Endpoints, there are no models to attribute costs to.
      const limitsOnly = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| GLM-5.1   | 880                 | 2,150             | 4,300              |',
        '| GLM-5     | 1,150               | 2,880             | 5,750              |',
      ].join('\n');

      const entries = service.parse(limitsOnly);
      expect(entries).toEqual([]);
    });

    it('still maps format correctly when only some endpoint rows have matching limits', () => {
      const partial = [
        '## Usage limits',
        '',
        '| Model     | requests per 5 hour | requests per week | requests per month |',
        '| --------- | ------------------- | ----------------- | ------------------ |',
        '| Qwen3.7 Max | 770               | 1,925             | 3,850              |',
        ENDPOINTS_TABLE,
      ].join('\n');

      const entries = service.parse(partial);
      const byId = Object.fromEntries(entries.map((e) => [e.id, e]));

      // Cost attached only to qwen3.7-max.
      expect(byId['qwen3.7-max']?.costPerRequestUsd).toBeCloseTo(
        OPENCODE_GO_BUDGET_5H_USD / 770,
        12,
      );
      expect(byId['glm-5.1']?.costPerRequestUsd).toBeNull();

      // But formats still correct for all endpoint rows.
      expect(byId['glm-5.1']?.format).toBe('openai');
      expect(byId['glm-5']?.format).toBe('openai');
      expect(byId['kimi-k2.5']?.format).toBe('openai');
      expect(byId['qwen3.7-max']?.format).toBe('anthropic');
    });
  });
});
