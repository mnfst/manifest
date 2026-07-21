import { validate } from 'class-validator';
import { UpdateLocaleDto } from './update-locale.dto';

describe('UpdateLocaleDto', () => {
  it.each(['en', 'ru'] as const)('accepts the supported locale %s', async (locale) => {
    const dto = new UpdateLocaleDto();
    dto.locale = locale;
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects unsupported and region-specific values at the API boundary', async () => {
    const dto = new UpdateLocaleDto();
    dto.locale = 'ru-RU' as 'ru';
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
