import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { Tenant } from '../entities/tenant.entity';
import { AdminController } from './controllers/admin.controller';
import { AdminKeyService } from './services/admin-key.service';
import { AdminAiGuard } from './guards/admin-ai.guard';

/**
 * Scoped AI-administration surface. Mounts the AdminController (gated by
 * AdminAiGuard) and the AdminKeyService (mints/resolves `mnfst_admin_ai_*`
 * keys as `api_keys` rows with `scope = 'ai_admin'`). Depends only on the
 * ApiKey and Tenant entities, both already managed by the global TypeORM
 * feature list.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, Tenant])],
  controllers: [AdminController],
  providers: [AdminKeyService, AdminAiGuard],
  exports: [AdminKeyService],
})
export class AdminModule {}
