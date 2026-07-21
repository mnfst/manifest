import { IsIn, IsString } from 'class-validator';
import { SUPPORTED_LOCALES, type AppLocale } from '../i18n/locale';

export class UpdateLocaleDto {
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  locale!: AppLocale;
}
