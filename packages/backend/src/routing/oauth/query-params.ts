import { HttpException, HttpStatus } from '@nestjs/common';

export function optionalTrimmedStringQuery(
  value: string | string[] | undefined,
  name: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new HttpException(`${name} query parameter must be a string`, HttpStatus.BAD_REQUEST);
  }
  return value.trim() || undefined;
}
