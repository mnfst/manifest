import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateBaselineDto } from './update-baseline.dto';

describe('UpdateBaselineDto', () => {
  it('validates with valid agent_name and model_id', async () => {
    const dto = plainToInstance(UpdateBaselineDto, {
      agent_name: 'demo',
      model_id: 'gpt-4o',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates with null model_id (reset to auto)', async () => {
    const dto = plainToInstance(UpdateBaselineDto, {
      agent_name: 'demo',
      model_id: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing agent_name', async () => {
    const dto = plainToInstance(UpdateBaselineDto, { model_id: 'gpt-4o' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects empty agent_name', async () => {
    const dto = plainToInstance(UpdateBaselineDto, {
      agent_name: '',
      model_id: 'gpt-4o',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects model_id exceeding MaxLength', async () => {
    const dto = plainToInstance(UpdateBaselineDto, {
      agent_name: 'demo',
      model_id: 'x'.repeat(257),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts model_id at max length', async () => {
    const dto = plainToInstance(UpdateBaselineDto, {
      agent_name: 'demo',
      model_id: 'x'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
