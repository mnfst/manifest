import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SetSpecificityOverrideDto } from './specificity.dto';

describe('SetSpecificityOverrideDto', () => {
  it('trims the provider key label and parses the nested route', async () => {
    const dto = plainToInstance(SetSpecificityOverrideDto, {
      model: 'gpt-4o',
      providerKeyLabel: '  Work  ',
      route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
    });
    expect(dto.providerKeyLabel).toBe('Work');
    expect(dto.route?.model).toBe('gpt-4o');
    expect(Array.isArray(await validate(dto))).toBe(true);
  });
});
