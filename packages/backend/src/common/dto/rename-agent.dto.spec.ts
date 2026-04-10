import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RenameAgentDto } from './rename-agent.dto';

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
});
