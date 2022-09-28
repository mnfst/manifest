import { SetMetadata } from '@nestjs/common';

export const Permission = (permission: string | string[]) =>
  SetMetadata('permission', permission);
