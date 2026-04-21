import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  RenameAgentDto,
  MIN_CONTEXT_FLOOR_OVERRIDE,
  MAX_CONTEXT_FLOOR_OVERRIDE,
} from './rename-agent.dto';

describe('RenameAgentDto', () => {
  it('accepts valid agent names', async () => {
    for (const name of ['my-agent', 'agent_1', 'TestBot', 'a', 'My Cool Agent']) {
      const dto = plainToInstance(RenameAgentDto, { name });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects empty name', async () => {
    const dto = plainToInstance(RenameAgentDto, { name: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows missing name (optional)', async () => {
    const dto = plainToInstance(RenameAgentDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts names with spaces', async () => {
    const dto = plainToInstance(RenameAgentDto, { name: 'has spaces' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects names with special characters', async () => {
    const dto = plainToInstance(RenameAgentDto, { name: 'agent@home!' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects names longer than 100 characters', async () => {
    const dto = plainToInstance(RenameAgentDto, { name: 'a'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid agent_category', async () => {
    const dto = plainToInstance(RenameAgentDto, { agent_category: 'personal' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid agent_category', async () => {
    const dto = plainToInstance(RenameAgentDto, { agent_category: 'invalid' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid agent_platform', async () => {
    const dto = plainToInstance(RenameAgentDto, { agent_platform: 'openclaw' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid agent_platform', async () => {
    const dto = plainToInstance(RenameAgentDto, { agent_platform: 'invalid' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  /**
   * context_floor_override cases — the per-agent lever for the honest
   * GET /v1/models advertisement. Defends the bounds that keep users from
   * advertising absurd values (0, 10 billion) that re-introduce the same
   * overflow/over-compaction bugs the feature exists to fix.
   */
  describe('context_floor_override', () => {
    it('accepts null (explicitly clears the override)', async () => {
      const dto = plainToInstance(RenameAgentDto, { context_floor_override: null });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('is optional (DTO is valid when the field is omitted entirely)', async () => {
      const dto = plainToInstance(RenameAgentDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts the documented minimum (1024)', async () => {
      const dto = plainToInstance(RenameAgentDto, {
        context_floor_override: MIN_CONTEXT_FLOOR_OVERRIDE,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts the documented maximum (10_000_000)', async () => {
      const dto = plainToInstance(RenameAgentDto, {
        context_floor_override: MAX_CONTEXT_FLOOR_OVERRIDE,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts a typical value inside the range', async () => {
      const dto = plainToInstance(RenameAgentDto, { context_floor_override: 128_000 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects values below the minimum', async () => {
      const dto = plainToInstance(RenameAgentDto, {
        context_floor_override: MIN_CONTEXT_FLOOR_OVERRIDE - 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects zero (clearing should be null, not 0)', async () => {
      const dto = plainToInstance(RenameAgentDto, { context_floor_override: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects negative values', async () => {
      const dto = plainToInstance(RenameAgentDto, { context_floor_override: -1 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects values above the maximum', async () => {
      const dto = plainToInstance(RenameAgentDto, {
        context_floor_override: MAX_CONTEXT_FLOOR_OVERRIDE + 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects non-integer floats', async () => {
      const dto = plainToInstance(RenameAgentDto, { context_floor_override: 128_000.5 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
