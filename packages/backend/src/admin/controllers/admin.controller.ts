import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { AdminAiGuard } from '../guards/admin-ai.guard';
import { AdminKeyService } from '../services/admin-key.service';

class CreateAdminKeyDto {
  @IsOptional()
  @IsString()
  name?: string;
}

/**
 * Scoped AI-administration surface (`/api/v1/admin`). Every route is gated by
 * AdminAiGuard, which requires a key with `scope = 'ai_admin'`. The handlers
 * reuse existing services; this controller only adds the key-management
 * operations that bootstrap and govern admin access itself.
 *
 * No handler returns a stored provider/harness secret. Key minting returns the
 * raw key exactly once at creation time.
 */
@Controller('api/v1/admin')
@UseGuards(AdminAiGuard)
export class AdminController {
  constructor(private readonly adminKeyService: AdminKeyService) {}

  @Post('keys')
  async createKey(@TenantCtx() ctx: TenantContext, @Body() body: CreateAdminKeyDto) {
    if (!ctx.tenantId) {
      throw new Error('Admin key creation requires a resolved tenant.');
    }
    const { id, key, keyPrefix } = await this.adminKeyService.createAdminKey({
      tenantId: ctx.tenantId,
      name: body?.name,
      createdByUserId: ctx.userId,
    });
    // Raw key returned exactly once.
    return { id, key, keyPrefix };
  }

  @Get('keys')
  async listKeys(@TenantCtx() ctx: TenantContext) {
    if (!ctx.tenantId) return { keys: [] };
    const keys = await this.adminKeyService.listAdminKeys(ctx.tenantId);
    return { keys };
  }

  @Delete('keys/:id')
  async revokeKey(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    if (!ctx.tenantId) return { revoked: false };
    await this.adminKeyService.revokeAdminKey(ctx.tenantId, id);
    return { revoked: true };
  }

  @Get('health')
  health() {
    return { status: 'ok', surface: 'admin' };
  }
}
