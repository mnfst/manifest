import { Module } from '@nestjs/common';
import { HookService } from './hook.service';

@Module({
  providers: [HookService]
})
export class HookModule {}
