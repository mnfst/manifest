import { IsIn } from 'class-validator';
import { SUPPORTED_LOCALES, type AppLocale } from '../i18n/locale';

export class UpdateLocaleDto {
  @IsIn([...SUPPORTED_LOCALES])
  locale!: AppLocale;
}
